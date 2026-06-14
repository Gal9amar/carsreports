import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { sendEmail } from './lib/mailer'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const rawPath = (event.path || event.rawUrl || '')
  const path = rawPath.replace(/^.*\/tickets/, '').replace(/\?.*$/, '') || '/'

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('אין הרשאה', 401)

  if (event.httpMethod === 'GET' && path === '/') {
    const rows = (await db.execute({
      sql: `SELECT id, subject, status, message, created_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC`,
      args: [user.id],
    })).rows
    return ok(rows)
  }

  if (event.httpMethod === 'POST' && path === '/') {
    const { subject, message } = JSON.parse(event.body || '{}')
    if (!subject || !message) return err('חסר subject/message')
    const id = randomUUID()
    await db.execute({
      sql: `INSERT INTO tickets (id, user_id, email, full_name, subject, message) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, user.email ?? '', user.full_name ?? '', subject, message],
    })
    const adminEmail = process.env.ADMIN_EMAIL || ''
    if (adminEmail) {
      try {
        await sendEmail(
          adminEmail,
          `[תמיכה] ${subject}`,
          `<p>קריאת תמיכה חדשה מ-<strong>${user.email}</strong>:</p><p>${String(message).replace(/\n/g, '<br>')}</p>`,
        )
      } catch { /* non-fatal */ }
    }
    // User acknowledgement
    try {
      const userEmail = user.email as string | undefined
      if (userEmail) {
        await sendEmail(
          userEmail,
          `📩 פנייתך התקבלה (#${id}) — CarsReports`,
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>קיבלנו את פנייתך בנושא '<strong>${String(subject)}</strong>'. נחזור אליך בהקדם.</p>
            <p>מספר פנייה: <strong>${id}</strong></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">CarsReports — בדיקת רכבים מקצועית</p>
          </div>`,
        )
      }
    } catch { /* non-fatal */ }
    return ok({ id })
  }

  const singleMatch = path.match(/^\/([^/]+)$/)
  if (event.httpMethod === 'GET' && singleMatch) {
    const ticketId = singleMatch[1]
    const ticket = (await db.execute({
      sql: `SELECT id, subject, status, message, email, created_at FROM tickets WHERE id = ? AND user_id = ?`,
      args: [ticketId, user.id],
    })).rows[0]
    if (!ticket) return err('לא נמצא', 404)
    const replies = (await db.execute({
      sql: `SELECT id, sender_name, is_admin, message, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC`,
      args: [ticketId],
    })).rows
    return ok({ ...ticket, replies })
  }

  const replyMatch = path.match(/^\/([^/]+)\/reply$/)
  if (event.httpMethod === 'POST' && replyMatch) {
    const ticketId = replyMatch[1]
    const ticket = (await db.execute({
      sql: `SELECT id, email FROM tickets WHERE id = ? AND user_id = ?`,
      args: [ticketId, user.id],
    })).rows[0] as { id: string; email: string } | undefined
    if (!ticket) return err('לא נמצא', 404)
    const { message } = JSON.parse(event.body || '{}')
    if (!message) return err('חסר message')
    const replyId = randomUUID()
    await db.execute({
      sql: `INSERT INTO ticket_replies (id, ticket_id, sender_id, sender_name, is_admin, message) VALUES (?, ?, ?, ?, 0, ?)`,
      args: [replyId, ticketId, user.id, user.full_name ?? user.email ?? 'משתמש'],
    })
    await db.execute({
      sql: `UPDATE tickets SET updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), ticketId],
    })
    // Notify admin of user reply
    try {
      const adminEmail = process.env.ADMIN_EMAIL || ''
      if (adminEmail) {
        const subjectRow = (await db.execute({
          sql: `SELECT subject FROM tickets WHERE id = ?`,
          args: [ticketId],
        })).rows[0] as { subject: string } | undefined
        const ticketSubject = subjectRow?.subject ?? ''
        await sendEmail(
          adminEmail,
          `💬 תגובה חדשה בפנייה #${ticketId} — CarsReports`,
          `<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e40af;">CarsReports 🚗</h2>
            <p>המשתמש הגיב בפנייה '<strong>${ticketSubject}</strong>':</p>
            <p>${String(message).replace(/\n/g, '<br>')}</p>
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
