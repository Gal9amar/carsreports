import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { fetchVehicleData } from './lib/govApi'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)
  if (user.blocked) return err('החשבון חסום', 403)

  const plate = event.queryStringParameters?.plate?.replace(/[^a-zA-Z0-9א-ת]/g, '').toUpperCase()
  if (!plate) return err('לוחית רישוי חסרה')

  const quota   = user.searches_quota as number
  const done    = user.searches_done as number
  const expires = user.quota_expires as string | null

  if (quota !== -1 && done >= quota) return err('נגמרו החיפושים. אנא רכוש חבילה.', 403)
  if (quota === -1 && expires && new Date(expires) < new Date()) {
    await db.execute({ sql: `UPDATE users SET searches_quota = 0, quota_expires = NULL WHERE id = ?`, args: [user.id] })
    await removeFromSubscribers(user.id as string)
    return err('פג תוקף המנוי', 403)
  }

  const data = await fetchVehicleData(plate)
  if (!data) return err('לא נמצא רכב עם לוחית זו', 404)

  await db.execute({ sql: `UPDATE users SET searches_done = searches_done + 1, last_plate = ? WHERE id = ?`, args: [plate, user.id] })
  await db.execute({
    sql: `INSERT INTO search_history (id, user_id, plate, searched_at) VALUES (?, ?, ?, datetime('now'))`,
    args: [randomUUID(), user.id, plate],
  })

  if (quota !== -1 && done + 1 >= quota) await removeFromSubscribers(user.id as string)

  return ok(data)
}

async function removeFromSubscribers(userId: string) {
  const group = await db.execute({ sql: `SELECT id FROM user_groups WHERE name = 'מנויים'`, args: [] })
  if (!group.rows.length) return
  await db.execute({
    sql: `DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?`,
    args: [group.rows[0].id, userId],
  })
}
