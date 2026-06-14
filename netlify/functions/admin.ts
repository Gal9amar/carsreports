import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { sendEmail } from './lib/mailer'
import { getSettings, setSetting } from './lib/settings'

const BOT_SETTINGS_KEYS = [
  'yad2_market_enabled', 'yad2_market_public', 'yad2_market_public_start', 'yad2_market_public_end', 'yad2_market_public_label',
  'yad2_watch_enabled', 'yad2_watch_max', 'yad2_watch_public', 'yad2_watch_public_start', 'yad2_watch_public_end', 'yad2_watch_public_label',
  'pdf_report_enabled', 'pdf_report_public', 'pdf_report_public_start', 'pdf_report_public_end', 'pdf_report_public_label',
]

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''

async function requireAdmin(headers: Record<string, string>) {
  const user = await getUserFromRequest(headers)
  if (!user) return null
  if (Number(user.is_admin) !== 1) return null
  return user
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const rawPath = (event.path || event.rawUrl || '')
  const path = rawPath.replace(/^.*\/admin/, '').replace(/\?.*$/, '') || '/'
  const qs = event.queryStringParameters || {}
  const admin = await requireAdmin(event.headers as Record<string, string>)
  if (!admin) return err('אין הרשאה', 403)

  // ── GET /api/admin/stats ──
  if (event.httpMethod === 'GET' && path === '/stats') {
    const users = (await db.execute({ sql: `SELECT COUNT(*) as c FROM users`, args: [] })).rows[0]
    const subscribers = (await db.execute({ sql: `SELECT COUNT(*) as c FROM users WHERE is_subscriber = 1`, args: [] })).rows[0]
    const pending = (await db.execute({ sql: `SELECT COUNT(*) as c FROM pending_payments`, args: [] })).rows[0]
    const searches = (await db.execute({ sql: `SELECT SUM(searches_done) as s FROM users`, args: [] })).rows[0]
    return ok({
      total_users: users.c,
      subscribers: subscribers.c,
      pending_payments: pending.c,
      total_searches: searches.s || 0,
    })
  }

  // ── GET /api/admin/users ──
  if (event.httpMethod === 'GET' && path === '/users') {
    const rows = (await db.execute({
      sql: `SELECT id, email, full_name, searches_done, searches_quota, searches_left, is_subscriber, is_admin, blocked, created_at
            FROM users ORDER BY created_at DESC LIMIT 200`,
      args: [],
    })).rows
    return ok(rows)
  }

  // ── POST /api/admin/users/:id/grant ──
  const grantMatch = path.match(/^\/users\/(.+)\/grant$/)
  if (event.httpMethod === 'POST' && grantMatch) {
    const userId = grantMatch[1]
    const { searches, is_subscriber } = JSON.parse(event.body || '{}')
    if (searches) {
      await db.execute({
        sql: `UPDATE users SET searches_quota = searches_quota + ?, searches_left = searches_left + ? WHERE id = ?`,
        args: [searches, searches, userId],
      })
    }
    if (is_subscriber !== undefined) {
      await db.execute({
        sql: `UPDATE users SET is_subscriber = ? WHERE id = ?`,
        args: [is_subscriber ? 1 : 0, userId],
      })
    }
    try {
      const userRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [userId] })).rows[0] as { email: string } | undefined
      if (userRow?.email) {
        if (searches) {
          await sendEmail(
            userRow.email,
            '🎁 קיבלת חיפושים במתנה — CarsReports',
            `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af;">CarsReports 🚗</h2>
              <p>המנהל הוסיף לך <strong>${searches} חיפושים</strong> לחשבון!</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
            </div>`,
          )
        }
        if (is_subscriber === true) {
          await sendEmail(
            userRow.email,
            '⭐ מנוי פעיל — CarsReports',
            `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af;">CarsReports 🚗</h2>
              <p>המנהל הפעיל לך מנוי חודשי!</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
            </div>`,
          )
        }
      }
    } catch { /* non-fatal */ }
    return ok({ ok: true })
  }

  // ── POST /api/admin/users/:id/block ──
  const blockMatch = path.match(/^\/users\/(.+)\/(block|unblock)$/)
  if (event.httpMethod === 'POST' && blockMatch) {
    const userId = blockMatch[1]
    const blocked = blockMatch[2] === 'block' ? 1 : 0
    await db.execute({ sql: `UPDATE users SET blocked = ? WHERE id = ?`, args: [blocked, userId] })
    return ok({ ok: true })
  }

  // ── GET /api/admin/payments ──
  if (event.httpMethod === 'GET' && path === '/payments') {
    const rows = (await db.execute({
      sql: `SELECT t.ref, t.user_id, t.searches, t.amount as price, t.label, t.status, t.created_at, t.updated_at,
                   u.email,
                   CASE WHEN p.ref IS NOT NULL THEN 1 ELSE 0 END as is_pending
            FROM paypal_transactions t
            LEFT JOIN users u ON u.id = t.user_id
            LEFT JOIN pending_payments p ON p.ref = t.ref
            ORDER BY t.created_at DESC LIMIT 200`,
      args: [],
    })).rows
    return ok(rows)
  }

  // ── POST /api/admin/payments/:ref/approve ──
  const approveMatch = path.match(/^\/payments\/(.+)\/approve$/)
  if (event.httpMethod === 'POST' && approveMatch) {
    const ref = approveMatch[1]
    const row = (await db.execute({
      sql: `SELECT user_id, searches, label FROM pending_payments WHERE ref = ?`,
      args: [ref],
    })).rows[0] as { user_id: string; searches: number; label: string } | undefined
    if (!row) return err('תשלום לא נמצא', 404)

    if (Number(row.searches) === -1) {
      const exp = new Date(); exp.setMonth(exp.getMonth() + 1)
      await db.execute({ sql: `UPDATE users SET is_subscriber = 1, subscription_expires = ? WHERE id = ?`, args: [exp.toISOString(), row.user_id] })
    } else {
      await db.execute({ sql: `UPDATE users SET searches_quota = searches_quota + ?, searches_left = searches_left + ? WHERE id = ?`, args: [row.searches, row.searches, row.user_id] })
    }
    await db.execute({ sql: `DELETE FROM pending_payments WHERE ref = ?`, args: [ref] })
    await db.execute({ sql: `UPDATE paypal_transactions SET status = 'admin_approved', updated_at = ? WHERE ref = ?`, args: [new Date().toISOString(), ref] })

    try {
      const userRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [row.user_id] })).rows[0] as { email: string } | undefined
      if (userRow?.email) await sendEmail(userRow.email, '✅ תשלום אושר — CarsReports', `<p>התשלום עבור <strong>${String(row.label)}</strong> אושר!</p>`)
    } catch { /* non-fatal */ }
    return ok({ ok: true })
  }

  // ── POST /api/admin/payments/:ref/decline ──
  const declineMatch = path.match(/^\/payments\/(.+)\/decline$/)
  if (event.httpMethod === 'POST' && declineMatch) {
    const ref = declineMatch[1]
    try {
      const ppRow = (await db.execute({
        sql: `SELECT user_id, label FROM pending_payments WHERE ref = ?`,
        args: [ref],
      })).rows[0] as { user_id: string; label: string } | undefined
      if (ppRow) {
        const userRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [ppRow.user_id] })).rows[0] as { email: string } | undefined
        if (userRow?.email) {
          await sendEmail(
            userRow.email,
            '❌ תשלום נדחה — CarsReports',
            `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af;">CarsReports 🚗</h2>
              <p>התשלום עבור <strong>${String(ppRow.label)}</strong> נדחה. אנא צור קשר עם התמיכה.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
            </div>`,
          )
        }
      }
    } catch { /* non-fatal */ }
    await db.execute({ sql: `DELETE FROM pending_payments WHERE ref = ?`, args: [ref] })
    await db.execute({ sql: `UPDATE paypal_transactions SET status = 'declined', updated_at = ? WHERE ref = ?`, args: [new Date().toISOString(), ref] })
    return ok({ ok: true })
  }

  // ── GET /api/admin/packages ──
  if (event.httpMethod === 'GET' && path === '/packages') {
    const rows = (await db.execute({ sql: `SELECT * FROM packages ORDER BY display_order, id`, args: [] })).rows
    return ok(rows)
  }

  // ── POST /api/admin/packages ──
  if (event.httpMethod === 'POST' && path === '/packages') {
    const { label, searches, price } = JSON.parse(event.body || '{}')
    await db.execute({
      sql: `INSERT INTO packages (label, searches, price, display_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(display_order),0)+1 FROM packages))`,
      args: [label, searches, price],
    })
    return ok({ ok: true })
  }

  // ── PUT /api/admin/packages/:id ──
  const pkgMatch = path.match(/^\/packages\/([^/]+)$/)
  if (event.httpMethod === 'PUT' && pkgMatch) {
    const { label, searches, price } = JSON.parse(event.body || '{}')
    await db.execute({ sql: `UPDATE packages SET label=?, searches=?, price=? WHERE id=?`, args: [label, searches, price, pkgMatch[1]] })
    return ok({ ok: true })
  }
  if (event.httpMethod === 'DELETE' && pkgMatch) {
    await db.execute({ sql: `DELETE FROM packages WHERE id=?`, args: [pkgMatch[1]] })
    return ok({ ok: true })
  }

  // ── GET /api/admin/activity ──
  if (event.httpMethod === 'GET' && path === '/activity') {
    const rows = (await db.execute({
      sql: `SELECT l.event_type as action, l.description, l.created_at, u.email
            FROM activity_log l LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.created_at DESC LIMIT 100`,
      args: [],
    })).rows
    return ok(rows)
  }

  // ── GET /api/admin/codes ──
  if (event.httpMethod === 'GET' && path === '/codes') {
    const rows = (await db.execute({
      sql: `SELECT c.code, c.searches, c.unlimited, c.single_use, c.expires, c.used_by, c.used_at, c.created,
                   (SELECT COUNT(*) FROM user_codes uc WHERE uc.code = c.code) as uses
            FROM codes c ORDER BY c.created DESC`,
      args: [],
    })).rows
    return ok(rows)
  }

  // ── POST /api/admin/codes ──
  if (event.httpMethod === 'POST' && path === '/codes') {
    const { code, searches, unlimited, single_use, expires } = JSON.parse(event.body || '{}')
    if (!code) return err('חסר code')
    const normalizedCode = String(code).trim().toUpperCase()
    await db.execute({
      sql: `INSERT INTO codes (code, searches, unlimited, single_use, expires) VALUES (?, ?, ?, ?, ?)`,
      args: [normalizedCode, searches || 0, unlimited ? 1 : 0, single_use !== false ? 1 : 0, expires || null],
    })
    return ok({ ok: true })
  }

  // ── DELETE /api/admin/codes/:code ──
  const codeMatch = path.match(/^\/codes\/(.+)$/)
  if (event.httpMethod === 'DELETE' && codeMatch) {
    await db.execute({ sql: `DELETE FROM codes WHERE code = ?`, args: [codeMatch[1]] })
    await db.execute({ sql: `DELETE FROM user_codes WHERE code = ?`, args: [codeMatch[1]] })
    return ok({ ok: true })
  }

  // ── GET /api/admin/settings ──
  if (event.httpMethod === 'GET' && path === '/settings') {
    const rows = (await db.execute({ sql: `SELECT key, value FROM app_settings`, args: [] })).rows as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    const botSettings = await getSettings(BOT_SETTINGS_KEYS)
    return ok({ ...settings, ...botSettings })
  }

  // ── POST /api/admin/settings ──
  if (event.httpMethod === 'POST' && path === '/settings') {
    const body = JSON.parse(event.body || '{}') as Record<string, string | null>
    for (const [key, value] of Object.entries(body)) {
      if (value === null) continue
      if (BOT_SETTINGS_KEYS.includes(key)) {
        await setSetting(key, String(value))
      } else {
        await db.execute({
          sql: `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          args: [key, String(value)],
        })
      }
    }
    return ok({ ok: true })
  }

  // ── POST /api/admin/gift-all ──
  if (event.httpMethod === 'POST' && path === '/gift-all') {
    const { searches } = JSON.parse(event.body || '{}')
    if (!searches || searches < 1) return err('כמות לא תקינה')
    await db.execute({
      sql: `UPDATE users SET searches_quota = searches_quota + ?, searches_left = searches_left + ? WHERE blocked = 0`,
      args: [searches, searches],
    })
    const count = (await db.execute({ sql: `SELECT COUNT(*) as c FROM users WHERE blocked = 0`, args: [] })).rows[0] as { c: number }
    return ok({ ok: true, count: count.c })
  }

  // ── POST /api/admin/broadcast ──
  if (event.httpMethod === 'POST' && path === '/broadcast') {
    const { subject, message } = JSON.parse(event.body || '{}')
    if (!subject || !message) return err('חסר subject/message')

    const users = (await db.execute({ sql: `SELECT email FROM users WHERE blocked = 0 AND email IS NOT NULL`, args: [] })).rows as { email: string }[]
    let sent = 0
    for (const u of users) {
      try { await sendEmail(u.email, subject, `<p>${message.replace(/\n/g, '<br>')}</p>`); sent++ } catch { /* skip */ }
    }
    return ok({ sent })
  }

  // ── GET /api/admin/tickets ──
  if (event.httpMethod === 'GET' && path === '/tickets') {
    const statusFilter = qs.status
    const rows = (await db.execute({
      sql: statusFilter
        ? `SELECT t.id, t.subject, t.status, t.email, t.full_name, t.created_at FROM tickets t WHERE t.status = ? ORDER BY t.created_at DESC`
        : `SELECT t.id, t.subject, t.status, t.email, t.full_name, t.created_at FROM tickets t ORDER BY t.created_at DESC`,
      args: statusFilter ? [statusFilter] : [],
    })).rows
    return ok(rows)
  }

  // ── GET /api/admin/tickets/:id ──
  const adminTicketMatch = path.match(/^\/tickets\/([^/]+)$/)
  if (event.httpMethod === 'GET' && adminTicketMatch) {
    const ticketId = adminTicketMatch[1]
    const ticket = (await db.execute({
      sql: `SELECT id, subject, status, message, email, full_name, created_at FROM tickets WHERE id = ?`,
      args: [ticketId],
    })).rows[0]
    if (!ticket) return err('לא נמצא', 404)
    const replies = (await db.execute({
      sql: `SELECT id, sender_name, is_admin, message, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC`,
      args: [ticketId],
    })).rows
    return ok({ ...ticket, replies })
  }

  // ── POST /api/admin/tickets/:id/reply ──
  const adminTicketReplyMatch = path.match(/^\/tickets\/([^/]+)\/reply$/)
  if (event.httpMethod === 'POST' && adminTicketReplyMatch) {
    const ticketId = adminTicketReplyMatch[1]
    const ticket = (await db.execute({
      sql: `SELECT id, email FROM tickets WHERE id = ?`,
      args: [ticketId],
    })).rows[0] as { id: string; email: string } | undefined
    if (!ticket) return err('לא נמצא', 404)
    const { message } = JSON.parse(event.body || '{}')
    if (!message) return err('חסר message')
    const { randomUUID } = await import('crypto')
    const replyId = randomUUID()
    await db.execute({
      sql: `INSERT INTO ticket_replies (id, ticket_id, sender_id, sender_name, is_admin, message) VALUES (?, ?, ?, ?, 1, ?)`,
      args: [replyId, ticketId, admin.id, 'תמיכה'],
    })
    await db.execute({
      sql: `UPDATE tickets SET updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), ticketId],
    })
    if (ticket.email) {
      try {
        await sendEmail(
          String(ticket.email),
          'תגובה לפנייתך — CarsReports',
          `<p>קיבלת תגובה לפנייתך:</p><p>${String(message).replace(/\n/g, '<br>')}</p>`,
        )
      } catch { /* non-fatal */ }
    }
    return ok({ ok: true })
  }

  // ── POST /api/admin/tickets/:id/close ──
  const adminTicketCloseMatch = path.match(/^\/tickets\/([^/]+)\/close$/)
  if (event.httpMethod === 'POST' && adminTicketCloseMatch) {
    const ticketId = adminTicketCloseMatch[1]
    await db.execute({
      sql: `UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), ticketId],
    })
    try {
      const tRow = (await db.execute({
        sql: `SELECT email, subject FROM tickets WHERE id = ?`,
        args: [ticketId],
      })).rows[0] as { email: string; subject: string } | undefined
      if (tRow?.email) {
        await sendEmail(
          tRow.email,
          `✅ פנייה ${ticketId} נסגרה — CarsReports`,
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>פנייתך בנושא '<strong>${String(tRow.subject)}</strong>' טופלה ונסגרה. תודה!</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
          </div>`,
        )
      }
    } catch { /* non-fatal */ }
    return ok({ ok: true })
  }

  // ── POST /api/admin/tickets/:id/open ──
  const adminTicketOpenMatch = path.match(/^\/tickets\/([^/]+)\/open$/)
  if (event.httpMethod === 'POST' && adminTicketOpenMatch) {
    const ticketId = adminTicketOpenMatch[1]
    await db.execute({
      sql: `UPDATE tickets SET status = 'open', updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), ticketId],
    })
    try {
      const tRow = (await db.execute({
        sql: `SELECT email FROM tickets WHERE id = ?`,
        args: [ticketId],
      })).rows[0] as { email: string } | undefined
      if (tRow?.email) {
        await sendEmail(
          tRow.email,
          `🔄 פנייה ${ticketId} נפתחה מחדש — CarsReports`,
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>פנייתך נפתחה מחדש ותטופל בקרוב.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
          </div>`,
        )
      }
    } catch { /* non-fatal */ }
    return ok({ ok: true })
  }

  return err('Not found', 404)
}
