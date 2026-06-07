import type { Handler } from '@netlify/functions'
import { initDb } from './lib/db'
import { ok, err, cors } from './lib/auth'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const secret = event.queryStringParameters?.secret
  if (secret !== process.env.JWT_SECRET) return err('Unauthorized', 401)

  try {
    await initDb()
    return ok({ message: 'DB initialized successfully' })
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'שגיאה', 500)
  }
}
