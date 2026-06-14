import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

interface BotSettingsRow {
  key: string
  value: string
}

async function getBotSettings(keys: string[]): Promise<Record<string, string>> {
  const placeholders = keys.map(() => '?').join(', ')
  const res = await db.execute({
    sql: `SELECT key, value FROM bot_settings WHERE key IN (${placeholders})`,
    args: keys,
  })
  const map: Record<string, string> = {}
  for (const row of res.rows as unknown as BotSettingsRow[]) {
    map[row.key] = row.value
  }
  return map
}

function isPublicWindowActive(start: string, end: string): boolean {
  if (!start || !end) return false
  const now = new Date()
  const s = new Date(start)
  const e = new Date(end)
  return now >= s && now <= e
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const rawPath: string = (event.rawUrl ? new URL(event.rawUrl).pathname : event.path) ?? ''
  const subPath = rawPath.replace(/^.*\/watches/, '').replace(/\?.*$/, '')

  // Feature gate check (shared across all methods)
  const settings = await getBotSettings([
    'yad2_watch_enabled',
    'yad2_watch_public',
    'yad2_watch_public_start',
    'yad2_watch_public_end',
    'yad2_watch_max',
  ])

  const isAdmin = Number(user.is_admin) === 1
  const isSubscriber = !!user.is_subscriber
  const enabled = settings['yad2_watch_enabled'] === '1'
  const publicWindow = settings['yad2_watch_public'] === '1' &&
    isPublicWindowActive(settings['yad2_watch_public_start'] ?? '', settings['yad2_watch_public_end'] ?? '')

  const hasAccess = isAdmin || isSubscriber || (enabled && publicWindow)
  if (!hasAccess) return err('אין גישה לתכונה זו', 403)

  // GET / — list user's watches
  if (event.httpMethod === 'GET' && subPath === '') {
    const res = await db.execute({
      sql: `SELECT id, make, model, year, active, created_at FROM yad2_watches WHERE user_id = ? ORDER BY created_at DESC`,
      args: [user.id as string],
    })
    const watches = res.rows.map(r => ({
      id: r.id,
      make: r.make,
      model: r.model,
      year: r.year ?? null,
      active: r.active === 1 || r.active === true,
      created_at: r.created_at,
    }))
    return ok(watches)
  }

  // POST / — create watch
  if (event.httpMethod === 'POST' && subPath === '') {
    const body = JSON.parse(event.body || '{}') as { make?: string; model?: string; year?: number }
    const { make, model = '', year } = body

    if (!make || String(make).trim() === '') return err('חסר יצרן')

    // Quota check
    const globalMax = parseInt(settings['yad2_watch_max'] ?? '3', 10) || 3
    const userQuota = user.watch_quota != null ? Number(user.watch_quota) : null
    const maxWatches = userQuota !== null ? userQuota : globalMax

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM yad2_watches WHERE user_id = ? AND active = 1`,
      args: [user.id as string],
    })
    const count = Number((countRes.rows[0] as unknown as { cnt: number }).cnt)
    if (count >= maxWatches) return err('הגעת למגבלת המעקבים', 403)

    await db.execute({
      sql: `INSERT INTO yad2_watches (user_id, make, model, year) VALUES (?, ?, ?, ?)`,
      args: [user.id as string, String(make).trim(), String(model).trim(), year ?? null],
    })
    return ok({ message: 'מעקב נוסף' }, 201)
  }

  // DELETE /:id — delete watch
  const idMatch = subPath.match(/^\/(\d+)$/)
  if (event.httpMethod === 'DELETE' && idMatch) {
    const id = parseInt(idMatch[1], 10)
    const existing = await db.execute({
      sql: `SELECT id FROM yad2_watches WHERE id = ? AND user_id = ?`,
      args: [id, user.id as string],
    })
    if (existing.rows.length === 0) return err('לא נמצא', 404)

    await db.execute({
      sql: `DELETE FROM yad2_watches WHERE id = ? AND user_id = ?`,
      args: [id, user.id as string],
    })
    return ok({ message: 'נמחק' })
  }

  // PATCH /:id/toggle — toggle active
  const toggleMatch = subPath.match(/^\/(\d+)\/toggle$/)
  if (event.httpMethod === 'PATCH' && toggleMatch) {
    const id = parseInt(toggleMatch[1], 10)
    const existing = await db.execute({
      sql: `SELECT id, active FROM yad2_watches WHERE id = ? AND user_id = ?`,
      args: [id, user.id as string],
    })
    if (existing.rows.length === 0) return err('לא נמצא', 404)

    const currentActive = Number((existing.rows[0] as unknown as { active: number }).active)
    const newActive = currentActive === 1 ? 0 : 1

    await db.execute({
      sql: `UPDATE yad2_watches SET active = ? WHERE id = ? AND user_id = ?`,
      args: [newActive, id, user.id as string],
    })
    return ok({ active: newActive === 1 })
  }

  return err('Method not allowed', 405)
}
