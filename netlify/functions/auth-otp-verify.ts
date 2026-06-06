import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { createSession, ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { email, code } = JSON.parse(event.body || '{}')
  if (!email || !code) return err('חסרים פרטים')

  const result = await db.execute({
    sql: `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') LIMIT 1`,
    args: [email, code],
  })

  if (!result.rows.length) return err('קוד שגוי או שפג תוקפו')

  await db.execute({
    sql: `UPDATE otp_codes SET used = 1 WHERE email = ?`,
    args: [email],
  })

  let user = (await db.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] })).rows[0]

  if (!user) {
    const userId = randomUUID()
    const freeSearches = await getFreeSearches()
    await db.execute({
      sql: `INSERT INTO users (id, email, provider, searches_quota) VALUES (?, ?, 'email', ?)`,
      args: [userId, email, freeSearches],
    })
    user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })).rows[0]
  } else {
    await db.execute({ sql: `UPDATE users SET last_seen = datetime('now') WHERE id = ?`, args: [user.id] })
  }

  const token = await createSession(user.id as string)
  return ok({ token, user })
}

async function getFreeSearches(): Promise<number> {
  const res = await db.execute({ sql: `SELECT value FROM app_settings WHERE key = 'free_searches'`, args: [] })
  return parseInt((res.rows[0]?.value as string) || '10', 10)
}
