import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { createSession, ok, err, cors } from './lib/auth'
import { sendEmail } from './lib/mailer'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { email, code, ref } = JSON.parse(event.body || '{}') as { email?: string; code?: string; ref?: string }
  if (!email || !code) return err('חסרים פרטים')

  const result = await db.execute({
    sql: `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 LIMIT 1`,
    args: [email, code],
  })

  if (!result.rows.length) return err('קוד שגוי או שפג תוקפו')

  const row = result.rows[0]
  if (new Date(row.expires_at as string) < new Date()) return err('קוד פג תוקף')

  await db.execute({ sql: `UPDATE otp_codes SET used = 1 WHERE email = ?`, args: [email] })

  const now = new Date().toISOString()
  let user = (await db.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] })).rows[0]

  if (!user) {
    const userId = randomUUID()
    const freeSearches = await getFreeSearches()
    await db.execute({
      sql: `INSERT INTO users (id, email, provider, searches_quota, first_seen, last_seen) VALUES (?, ?, 'email', ?, ?, ?)`,
      args: [userId, email, freeSearches, now, now],
    })
    user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })).rows[0]

    // Welcome email
    try {
      await sendEmail(
        email,
        'ברוך הבא ל-CarsReports! 🚗',
        `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">CarsReports 🚗</h2>
          <p>ברוך הבא ל-CarsReports!</p>
          <p>חשבונך נוצר בהצלחה. קיבלת <strong>${freeSearches} חיפושים חינמיים</strong> להתחיל איתם.</p>
          <p><a href="${process.env.URL || 'https://carsreports.netlify.app'}" style="color: #1e40af;">כנס לאתר ותתחיל לחפש</a></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
        </div>`,
      )
    } catch { /* non-fatal */ }

    if (ref) {
      const referrerRes = await db.execute({
        sql: `SELECT id FROM users WHERE id LIKE ? LIMIT 1`,
        args: [ref + '%'],
      })
      if (referrerRes.rows.length) {
        const referrerId = referrerRes.rows[0].id as string
        const bonusRes = await db.execute({
          sql: `SELECT value FROM app_settings WHERE key = 'referral_bonus'`,
          args: [],
        })
        const bonus = parseInt((bonusRes.rows[0]?.value as string) || '10', 10)
        await db.execute({
          sql: `UPDATE users SET searches_left = searches_left + ? WHERE id = ?`,
          args: [bonus, referrerId],
        })
        await db.execute({
          sql: `INSERT INTO referrals (id, referrer_id, referee_id, bonus, joined_at) VALUES (?, ?, ?, ?, ?)`,
          args: [randomUUID(), referrerId, userId, bonus, now],
        })
        await db.execute({
          sql: `INSERT INTO activity_log (id, event_type, user_id, description, created_at) VALUES (?, ?, ?, ?, ?)`,
          args: [randomUUID(), 'referral', referrerId, `New referral: ${email} (bonus: ${bonus})`, now],
        })

        // Notify referrer
        try {
          const referrerEmailRes = await db.execute({
            sql: `SELECT email FROM users WHERE id = ?`,
            args: [referrerId],
          })
          const referrerEmail = referrerEmailRes.rows[0]?.email as string | undefined
          if (referrerEmail) {
            await sendEmail(
              referrerEmail,
              `🎁 חבר הצטרף — קיבלת ${bonus} חיפושים!`,
              `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1e40af;">CarsReports 🚗</h2>
                <p>חברך הצטרף ל-CarsReports וקיבלת <strong>${bonus} חיפושים</strong> במתנה!</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
              </div>`,
            )
          }
        } catch { /* non-fatal */ }
      }
    }
  } else {
    await db.execute({ sql: `UPDATE users SET last_seen = ? WHERE id = ?`, args: [now, user.id] })
  }

  const token = await createSession(user.id as string)
  return ok({ token, user })
}

async function getFreeSearches(): Promise<number> {
  const res = await db.execute({ sql: `SELECT value FROM app_settings WHERE key = 'free_searches'`, args: [] })
  return parseInt((res.rows[0]?.value as string) || '10', 10)
}
