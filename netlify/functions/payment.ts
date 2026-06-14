import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { sendEmail } from './lib/mailer'

const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID || ''
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ''
const PAYPAL_WEBHOOK_ID    = process.env.PAYPAL_WEBHOOK_ID || ''
const PAYPAL_MODE          = process.env.PAYPAL_MODE || 'live'
const PAYPAL_BASE          = PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'
const SITE_URL             = process.env.URL || 'https://carsreports.netlify.app'
const ADMIN_EMAIL          = process.env.ADMIN_EMAIL || ''

// ── PayPal helpers ──────────────────────────────────────────────────────────

async function getPayPalToken(): Promise<string> {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function createPayPalOrder(ref: string, amount: number, label: string) {
  const token = await getPayPalToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'ILS', value: amount.toFixed(2) },
        description: label,
        custom_id: ref,
      }],
      application_context: {
        brand_name: 'CarsReports',
        user_action: 'PAY_NOW',
        return_url: `${SITE_URL}/api/payment-return?ref=${ref}`,
        cancel_url: `${SITE_URL}/api/payment-cancel?ref=${ref}`,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ id: string; links: { rel: string; href: string }[] }>
}

async function capturePayPalOrder(orderId: string) {
  const token = await getPayPalToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  })
  return res.json() as Promise<Record<string, unknown>>
}

async function verifyWebhookSignature(headers: Record<string, string>, body: string): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID) return true
  const token = await getPayPalToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'] || '',
      cert_url: headers['paypal-cert-url'] || '',
      transmission_id: headers['paypal-transmission-id'] || '',
      transmission_sig: headers['paypal-transmission-sig'] || '',
      transmission_time: headers['paypal-transmission-time'] || '',
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(body),
    }),
  })
  if (!res.ok) return false
  const data = await res.json() as { verification_status: string }
  return data.verification_status === 'SUCCESS'
}

// ── Grant approved payment ──────────────────────────────────────────────────

async function grantPayment(ref: string) {
  const rows = (await db.execute({
    sql: `SELECT user_id, searches, label FROM pending_payments WHERE ref = ?`,
    args: [ref],
  })).rows
  if (!rows.length) return

  const { user_id, searches, label } = rows[0] as { user_id: string; searches: number; label: string }

  if (Number(searches) === -1) {
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + 1)
    await db.execute({
      sql: `UPDATE users SET is_subscriber = 1, subscription_expires = ? WHERE id = ?`,
      args: [expiry.toISOString(), user_id],
    })
  } else {
    await db.execute({
      sql: `UPDATE users SET searches_quota = searches_quota + ?, searches_left = searches_left + ? WHERE id = ?`,
      args: [searches, searches, user_id],
    })
  }

  await db.execute({ sql: `DELETE FROM pending_payments WHERE ref = ?`, args: [ref] })

  await db.execute({
    sql: `UPDATE paypal_transactions SET status = 'completed', updated_at = ? WHERE ref = ?`,
    args: [new Date().toISOString(), ref],
  })

  // Email user
  try {
    const userRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [user_id] })).rows[0] as { email: string } | undefined
    if (userRow?.email) {
      await sendEmail(
        userRow.email,
        '✅ תשלום אושר — CarsReports',
        `<p>שלום,</p><p>התשלום עבור <strong>${String(label)}</strong> אושר בהצלחה!</p><p>החיפושים נוספו לחשבונך.</p>`,
      )
    }
  } catch { /* non-fatal */ }

  // Email admin
  try {
    if (ADMIN_EMAIL) {
      await sendEmail(
        ADMIN_EMAIL,
        `💳 תשלום אושר — ${String(label)}`,
        `<p>תשלום <strong>${String(label)}</strong> (ref: ${ref}) אושר אוטומטית.</p>`,
      )
    }
  } catch { /* non-fatal */ }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const path = (event.path || '').replace(/.*\/payment/, '').replace(/\?.*$/, '')

  // ── POST /api/payment/initiate ──
  if (event.httpMethod === 'POST' && path === '/initiate') {
    const user = await getUserFromRequest(event.headers as Record<string, string>)
    if (!user) return err('לא מחובר', 401)

    const { package_id, quantity = 1 } = JSON.parse(event.body || '{}')
    if (!package_id) return err('חסר package_id')

    const pkgRow = (await db.execute({ sql: `SELECT * FROM packages WHERE id = ?`, args: [package_id] })).rows[0] as {
      id: string; label: string; searches: number; price: number
    } | undefined
    if (!pkgRow) return err('חבילה לא נמצאה', 404)

    const qty = Math.max(1, Math.min(10, Number(quantity)))
    const totalPrice = pkgRow.price * qty
    const totalSearches = pkgRow.searches === -1 ? -1 : pkgRow.searches * qty
    const label = qty > 1 ? `${pkgRow.label} ×${qty}` : pkgRow.label
    const ref = `${user.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`

    // Save pending
    await db.execute({
      sql: `INSERT INTO pending_payments (ref, user_id, searches, price, label) VALUES (?, ?, ?, ?, ?)`,
      args: [ref, user.id, totalSearches, totalPrice, label],
    })

    // Try PayPal API
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET) {
      try {
        const order = await createPayPalOrder(ref, totalPrice, label)
        const approvalUrl = order.links.find(l => l.rel === 'approve')?.href || ''

        await db.execute({
          sql: `INSERT INTO paypal_transactions (ref, paypal_order_id, user_id, amount, label, searches, status) VALUES (?, ?, ?, ?, ?, ?, 'created')`,
          args: [ref, order.id, user.id, totalPrice, label, totalSearches],
        })

        await db.execute({
          sql: `UPDATE pending_payments SET paypal_order_id = ? WHERE ref = ?`,
          args: [order.id, ref],
        })

        return ok({ ref, approval_url: approvalUrl, label, price: totalPrice, searches: totalSearches })
      } catch (e) {
        console.error('PayPal order creation failed:', e)
        // fall through to PayPal.me
      }
    }

    // Fallback: PayPal.me
    const paypalMe = process.env.PAYPAL_ME || ''
    const approvalUrl = paypalMe ? `${paypalMe}/${totalPrice}ILS` : ''
    return ok({ ref, approval_url: approvalUrl, label, price: totalPrice, searches: totalSearches, manual: true })
  }

  // ── GET /api/payment/status?ref=xxx ──
  if (event.httpMethod === 'GET' && path === '/status') {
    const user = await getUserFromRequest(event.headers as Record<string, string>)
    if (!user) return err('לא מחובר', 401)

    const ref = event.queryStringParameters?.ref
    if (!ref) return err('חסר ref')

    const tx = (await db.execute({
      sql: `SELECT status FROM paypal_transactions WHERE ref = ? AND user_id = ?`,
      args: [ref, user.id],
    })).rows[0] as { status: string } | undefined

    const pending = (await db.execute({
      sql: `SELECT ref FROM pending_payments WHERE ref = ?`,
      args: [ref],
    })).rows[0]

    const completed = tx?.status === 'completed' || (!pending && tx)

    return ok({ status: tx?.status || 'unknown', completed: !!completed })
  }

  // ── POST /api/payment/cancel ──
  if (event.httpMethod === 'POST' && path === '/cancel') {
    const { ref } = JSON.parse(event.body || '{}')
    if (ref) {
      await db.execute({
        sql: `UPDATE paypal_transactions SET status = 'user_cancelled', updated_at = ? WHERE ref = ?`,
        args: [new Date().toISOString(), ref],
      })
      await db.execute({ sql: `DELETE FROM pending_payments WHERE ref = ?`, args: [ref] })
    }
    return ok({ ok: true })
  }

  // ── POST /api/payment/webhook (PayPal IPN) ──
  if (event.httpMethod === 'POST' && path === '/webhook') {
    const body = event.body || ''
    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v || ''])
    )

    if (PAYPAL_WEBHOOK_ID) {
      const valid = await verifyWebhookSignature(headers, body)
      if (!valid) return { statusCode: 400, body: 'Invalid signature' }
    }

    const payload = JSON.parse(body) as { event_type: string; resource: Record<string, unknown> }
    const { event_type, resource } = payload

    if (event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = String(resource.id || '')
      const customId = String(((resource.purchase_units as Record<string, unknown>[])?.[0]?.custom_id) || '')
      if (orderId) {
        await db.execute({
          sql: `UPDATE paypal_transactions SET status = 'approved', updated_at = ? WHERE paypal_order_id = ?`,
          args: [new Date().toISOString(), orderId],
        })
        try {
          await capturePayPalOrder(orderId)
          await db.execute({
            sql: `UPDATE paypal_transactions SET status = 'captured', updated_at = ? WHERE paypal_order_id = ?`,
            args: [new Date().toISOString(), orderId],
          })
          const ref = customId || (await db.execute({
            sql: `SELECT ref FROM paypal_transactions WHERE paypal_order_id = ?`,
            args: [orderId],
          })).rows[0]?.ref as string
          if (ref) await grantPayment(String(ref))
        } catch (e) {
          console.error('Capture failed:', e)
          await db.execute({
            sql: `UPDATE paypal_transactions SET status = 'failed', updated_at = ? WHERE paypal_order_id = ?`,
            args: [new Date().toISOString(), orderId],
          })
          // Notify user and admin of capture failure
          try {
            const txRow = (await db.execute({
              sql: `SELECT user_id FROM paypal_transactions WHERE paypal_order_id = ?`,
              args: [orderId],
            })).rows[0] as { user_id: string } | undefined
            if (txRow?.user_id) {
              const userRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [txRow.user_id] })).rows[0] as { email: string } | undefined
              if (userRow?.email) {
                await sendEmail(
                  userRow.email,
                  '⚠️ בעיה בעיבוד התשלום — CarsReports',
                  `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1e40af;">CarsReports 🚗</h2>
                    <p>אירעה בעיה בעיבוד תשלומך. אנא צור קשר עם התמיכה עם מספר הזמנה: <strong>${orderId}</strong></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
                  </div>`,
                )
              }
            }
          } catch { /* non-fatal */ }
          try {
            if (ADMIN_EMAIL) {
              const errMsg = e instanceof Error ? e.message : String(e)
              await sendEmail(
                ADMIN_EMAIL,
                '⚠️ כשל בלכידת תשלום',
                `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1e40af;">CarsReports 🚗</h2>
                  <p>כשל ב-capture של order <strong>${orderId}</strong> — ${errMsg}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
                </div>`,
              )
            }
          } catch { /* non-fatal */ }
        }
      }
    } else if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = String((resource.supplementary_data as Record<string, unknown> | undefined)
        ?.related_ids as Record<string, unknown> | undefined
        ?? {})
      if (orderId) {
        const row = (await db.execute({
          sql: `SELECT ref FROM paypal_transactions WHERE paypal_order_id = ?`,
          args: [orderId],
        })).rows[0]
        if (row?.ref) await grantPayment(String(row.ref))
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  }

  return err('Not found', 404)
}
