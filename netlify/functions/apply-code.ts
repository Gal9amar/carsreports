import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { sendEmail } from './lib/mailer'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const { code } = JSON.parse(event.body || '{}')
  if (!code?.trim()) return err('קוד לא תקין')

  const normalizedCode = String(code).trim().toUpperCase()

  // Check if code exists
  const codeRow = (await db.execute({
    sql: `SELECT * FROM codes WHERE code = ?`,
    args: [normalizedCode],
  })).rows[0] as {
    code: string; searches: number; unlimited: number; single_use: number; expires: string | null; used_by: string | null
  } | undefined

  if (!codeRow) return err('קוד לא קיים')

  // Check expiry
  if (codeRow.expires && new Date(codeRow.expires) < new Date()) return err('הקוד פג תוקף')

  // Check single-use already used
  if (codeRow.single_use && codeRow.used_by) return err('קוד כבר נוצל')

  // Check if this user already used this code
  const alreadyUsed = (await db.execute({
    sql: `SELECT 1 FROM user_codes WHERE user_id = ? AND code = ?`,
    args: [user.id, normalizedCode],
  })).rows[0]
  if (alreadyUsed) return err('כבר השתמשת בקוד זה')

  // Apply code
  if (codeRow.unlimited) {
    const exp = new Date()
    exp.setMonth(exp.getMonth() + 1)
    await db.execute({
      sql: `UPDATE users SET is_subscriber = 1, subscription_expires = ? WHERE id = ?`,
      args: [exp.toISOString(), user.id],
    })
  } else {
    await db.execute({
      sql: `UPDATE users SET searches_quota = searches_quota + ?, searches_left = searches_left + ? WHERE id = ?`,
      args: [codeRow.searches, codeRow.searches, user.id],
    })
  }

  // Record usage
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_codes (user_id, code) VALUES (?, ?)`,
    args: [user.id, normalizedCode],
  })

  if (codeRow.single_use) {
    await db.execute({
      sql: `UPDATE codes SET used_by = ?, used_at = ? WHERE code = ?`,
      args: [user.id, new Date().toISOString(), normalizedCode],
    })
  }

  // Log activity
  try {
    await db.execute({
      sql: `INSERT INTO activity_log (id, event_type, user_id, description) VALUES (?, 'code_applied', ?, ?)`,
      args: [randomUUID(), user.id, `קוד ${normalizedCode} הופעל`],
    })
  } catch { /* non-fatal */ }

  // Email confirmation
  try {
    const userEmailRow = (await db.execute({ sql: `SELECT email FROM users WHERE id = ?`, args: [user.id] })).rows[0] as { email: string } | undefined
    if (userEmailRow?.email) {
      if (codeRow.unlimited) {
        await sendEmail(
          userEmailRow.email,
          '🎉 מנוי הופעל — CarsReports',
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>קוד הגישה הופעל בהצלחה! מנוי חודשי פעיל בחשבונך.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
          </div>`,
        )
      } else {
        await sendEmail(
          userEmailRow.email,
          '✅ קוד גישה הופעל — CarsReports',
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>קוד הגישה הופעל! <strong>${codeRow.searches} חיפושים</strong> נוספו לחשבונך.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
          </div>`,
        )
      }
    }
  } catch { /* non-fatal */ }

  return ok({
    ok: true,
    searches: codeRow.unlimited ? 0 : codeRow.searches,
    unlimited: !!codeRow.unlimited,
    message: codeRow.unlimited
      ? '🎉 מנוי חודשי הופעל בהצלחה!'
      : `✅ ${codeRow.searches} חיפושים נוספו לחשבונך!`,
  })
}
