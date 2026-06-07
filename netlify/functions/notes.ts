import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const plate = event.queryStringParameters?.plate?.replace(/[^a-zA-Z0-9א-ת]/g, '').toUpperCase()
  if (!plate) return err('חסרת לוחית')

  if (event.httpMethod === 'GET') {
    const res = await db.execute({ sql: `SELECT note FROM plate_notes WHERE user_id = ? AND plate = ?`, args: [user.id, plate] })
    return ok({ note: res.rows[0]?.note ?? '' })
  }

  if (event.httpMethod === 'POST') {
    const { note } = JSON.parse(event.body || '{}')
    if (note === undefined) return err('חסרת note')

    if (!note.trim()) {
      await db.execute({ sql: `DELETE FROM plate_notes WHERE user_id = ? AND plate = ?`, args: [user.id, plate] })
      return ok({ message: 'נמחק' })
    }

    await db.execute({
      sql: `INSERT INTO plate_notes (id, user_id, plate, note) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, plate) DO UPDATE SET note = excluded.note, updated_at = datetime('now')`,
      args: [randomUUID(), user.id, plate, note.trim()],
    })
    return ok({ message: 'נשמר' })
  }

  return err('Method not allowed', 405)
}
