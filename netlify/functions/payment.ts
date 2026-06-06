import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const path = event.path.replace(/.*\/payment/, '')

  if (event.httpMethod === 'POST' && path === '/initiate') {
    const { package_id } = JSON.parse(event.body || '{}')
    if (!package_id) return err('חסר package_id')

    const pkg = (await db.execute({ sql: `SELECT * FROM packages WHERE id = ?`, args: [package_id] })).rows[0]
    if (!pkg) return err('חבילה לא נמצאה', 404)

    const ref = randomUUID().slice(0, 8).toUpperCase()
    await db.execute({
      sql: `INSERT INTO pending_payments (id, ref, user_id, searches, price, label) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), ref, user.id, pkg.searches, pkg.price, pkg.label],
    })

    const paypalMe = (await db.execute({ sql: `SELECT value FROM app_settings WHERE key = 'paypal_me'`, args: [] })).rows[0]?.value || ''

    return ok({ ref, paypal_url: `${paypalMe}/${pkg.price}` })
  }

  if (event.httpMethod === 'POST' && path === '/confirm') {
    const { ref } = JSON.parse(event.body || '{}')
    if (!ref) return err('חסר ref')

    const payment = (await db.execute({ sql: `SELECT * FROM pending_payments WHERE ref = ? AND user_id = ?`, args: [ref, user.id] })).rows[0]
    if (!payment) return err('תשלום לא נמצא', 404)

    const adminEmail = (await db.execute({ sql: `SELECT value FROM app_settings WHERE key = 'admin_email'`, args: [] })).rows[0]?.value
    // Email notification to admin handled separately via webhook or manual check

    return ok({ message: 'קיבלנו את הודעתך. המנהל יאשר בקרוב.' })
  }

  return err('Not found', 404)
}
