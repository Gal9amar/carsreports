import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405)

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const result = await db.execute({
    sql: `SELECT plate, MAX(searched_at) as searched_at FROM search_history WHERE user_id = ? GROUP BY plate ORDER BY searched_at DESC LIMIT 20`,
    args: [user.id],
  })

  return ok(result.rows)
}
