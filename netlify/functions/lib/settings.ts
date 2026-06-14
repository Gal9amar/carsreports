import { db } from './db'

export async function getSetting(key: string): Promise<string> {
  const row = (await db.execute({ sql: 'SELECT value FROM bot_settings WHERE key = ?', args: [key] })).rows[0] as { value: string } | undefined
  return row?.value ?? ''
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({ sql: 'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [key, value] })
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = (await db.execute({ sql: `SELECT key, value FROM bot_settings WHERE key IN (${keys.map(() => '?').join(',')})`, args: keys })).rows as { key: string; value: string }[]
  const result: Record<string, string> = {}
  for (const row of rows) result[row.key] = row.value
  return result
}

// Returns true if user has access to a feature
export function checkFeatureAccess(opts: {
  isAdmin: boolean
  isSubscriber: boolean
  searchesLeft: number
  enabled: string
  publicOn: string
  publicStart: string
  publicEnd: string
}): boolean {
  if (opts.isAdmin) return true
  if (opts.isSubscriber) return true
  if (opts.searchesLeft > 0) return true
  if (opts.enabled === '0') return false
  if (opts.publicOn === '1') {
    const today = new Date().toISOString().slice(0, 10)
    const start = opts.publicStart || ''
    const end = opts.publicEnd || ''
    if ((!start || today >= start) && (!end || today <= end)) return true
  }
  return false
}

// Strict check — only admin/subscriber/public window (not just searches_left)
export function checkStrictAccess(opts: {
  isAdmin: boolean
  isSubscriber: boolean
  enabled: string
  publicOn: string
  publicStart: string
  publicEnd: string
}): boolean {
  if (opts.isAdmin) return true
  if (opts.isSubscriber) return true
  if (opts.enabled !== '1') return false
  if (opts.publicOn === '1') {
    const today = new Date().toISOString().slice(0, 10)
    const start = opts.publicStart || ''
    const end = opts.publicEnd || ''
    if ((!start || today >= start) && (!end || today <= end)) return true
  }
  return false
}
