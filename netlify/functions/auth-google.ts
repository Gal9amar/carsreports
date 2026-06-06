import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { createSession, ok, err, cors } from './lib/auth'

// Verifies Google ID token and creates/updates user
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { id_token } = JSON.parse(event.body || '{}')
  if (!id_token) return err('חסר id_token')

  // Verify token with Google
  const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`)
  if (!googleRes.ok) return err('אימות Google נכשל')

  const payload = await googleRes.json() as {
    sub: string
    email: string
    name?: string
    picture?: string
    aud: string
  }

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) return err('Client ID לא תקין')

  const { email, name, picture, sub } = payload

  let user = (await db.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] })).rows[0]

  if (!user) {
    const userId = randomUUID()
    const freeSearches = await getFreeSearches()
    await db.execute({
      sql: `INSERT INTO users (id, email, full_name, avatar_url, provider, searches_quota) VALUES (?, ?, ?, ?, 'google', ?)`,
      args: [userId, email, name ?? null, picture ?? null, freeSearches],
    })
    user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })).rows[0]
  } else {
    await db.execute({
      sql: `UPDATE users SET last_seen = datetime('now'), full_name = COALESCE(full_name, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`,
      args: [name ?? null, picture ?? null, user.id],
    })
  }

  const token = await createSession(user.id as string)
  return ok({ token, user })
}

async function getFreeSearches(): Promise<number> {
  const res = await db.execute({ sql: `SELECT value FROM app_settings WHERE key = 'free_searches'`, args: [] })
  return parseInt((res.rows[0]?.value as string) || '10', 10)
}
