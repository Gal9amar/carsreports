import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  await db.execute({ sql: `UPDATE users SET last_seen = datetime('now') WHERE id = ?`, args: [user.id] })

  const isSub = await isSubscriber(user.id as string)
  const isAdmin = await isAdminUser(user.id as string)

  const searchesLeft = user.searches_quota === -1 ? -1 : Math.max(0, (user.searches_quota as number) - (user.searches_done as number))

  return ok({
    ...user,
    searches_left: searchesLeft,
    is_subscriber: isSub,
    is_admin: isAdmin,
  })
}

async function isSubscriber(userId: unknown) {
  const res = await db.execute({
    sql: `SELECT 1 FROM user_group_members ugm JOIN user_groups ug ON ugm.group_id = ug.id WHERE ugm.user_id = ? AND ug.name = 'מנויים'`,
    args: [userId],
  })
  return res.rows.length > 0
}

async function isAdminUser(userId: unknown) {
  const res = await db.execute({
    sql: `SELECT 1 FROM user_group_members ugm JOIN user_groups ug ON ugm.group_id = ug.id WHERE ugm.user_id = ? AND ug.name = 'מנהלים'`,
    args: [userId],
  })
  return res.rows.length > 0
}
