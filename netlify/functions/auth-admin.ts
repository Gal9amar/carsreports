import type { Handler } from '@netlify/functions'
import { randomUUID } from 'crypto'
import { db } from './lib/db'
import { createSession, ok, err, cors } from './lib/auth'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@carreports.local'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  const { password } = JSON.parse(event.body || '{}')
  if (!password || password !== ADMIN_PASSWORD) return err('סיסמה שגויה', 401)

  // Ensure admin user exists
  let user = (await db.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [ADMIN_EMAIL] })).rows[0]

  if (!user) {
    const userId = randomUUID()
    await db.execute({
      sql: `INSERT INTO users (id, email, full_name, provider, searches_quota) VALUES (?, ?, 'אדמין', 'admin', -1)`,
      args: [userId, ADMIN_EMAIL],
    })
    // Add to admins group
    const group = (await db.execute({ sql: `SELECT id FROM user_groups WHERE name = 'מנהלים'`, args: [] })).rows[0]
    if (group) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)`,
        args: [group.id, userId],
      })
    }
    user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })).rows[0]
  }

  const token = await createSession(user.id as string)
  return ok({ token, user })
}
