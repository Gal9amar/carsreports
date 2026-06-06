import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405)

  const result = await db.execute({ sql: `SELECT * FROM packages WHERE active = 1 ORDER BY price ASC`, args: [] })
  return ok(result.rows)
}
