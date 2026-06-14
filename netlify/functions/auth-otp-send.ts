import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { sendOtpEmail } from './lib/mailer'
import { ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { email } = JSON.parse(event.body || '{}')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('כתובת אימייל לא תקינה')
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  await db.execute({ sql: `DELETE FROM otp_codes WHERE email = ?`, args: [email] })

  await db.execute({
    sql: `INSERT INTO otp_codes (id, email, code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [randomUUID(), email, code, expires, now],
  })

  await sendOtpEmail(email, code)

  return ok({ message: 'קוד נשלח לאימייל' })
}
