import type { Handler } from '@netlify/functions'
import { db, initDb } from './lib/db'
import { ok, err, cors } from './lib/auth'

const ALTER_STMTS = [
  `ALTER TABLE users ADD COLUMN searches_left INTEGER NOT NULL DEFAULT 10`,
  `ALTER TABLE users ADD COLUMN is_subscriber INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN subscription_expires TEXT`,
  `ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN created_at TEXT`,
  `ALTER TABLE users ADD COLUMN watch_quota INTEGER DEFAULT NULL`,
]

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return err('Method not allowed', 405)

  try {
    // Create all tables and seed data
    await initDb()

    // Apply any missing columns to existing DBs — ignore errors (column may already exist)
    const alterResults: { sql: string; ok: boolean; error?: string }[] = []
    for (const sql of ALTER_STMTS) {
      try {
        await db.execute(sql)
        alterResults.push({ sql, ok: true })
      } catch (e: unknown) {
        alterResults.push({ sql, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }

    return ok({ message: 'DB initialized successfully', alterResults })
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'שגיאה', 500)
  }
}
