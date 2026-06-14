import type { Handler } from '@netlify/functions'
import { db } from './lib/db'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { getSettings, checkFeatureAccess } from './lib/settings'

const FEATURE_KEYS = [
  'yad2_market_enabled', 'yad2_market_public', 'yad2_market_public_start', 'yad2_market_public_end',
  'yad2_watch_enabled', 'yad2_watch_public', 'yad2_watch_public_start', 'yad2_watch_public_end',
  'yad2_watch_max',
  'pdf_report_enabled', 'pdf_report_public', 'pdf_report_public_start', 'pdf_report_public_end',
  'yad2_market_public_label', 'yad2_watch_public_label', 'pdf_report_public_label',
]

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  await db.execute({ sql: `UPDATE users SET last_seen = datetime('now') WHERE id = ?`, args: [user.id] })

  const searchesLeft = user.searches_left !== undefined && user.searches_left !== null
    ? Number(user.searches_left)
    : user.searches_quota === -1 ? -1 : Math.max(0, (user.searches_quota as number) - (user.searches_done as number))

  const isSubscriber = !!(user.is_subscriber) || !!(user.subscription_expires && new Date(user.subscription_expires as string) > new Date())
  const isAdmin = !!(user.is_admin)

  const s = await getSettings(FEATURE_KEYS)

  const featureBase = { isAdmin, isSubscriber, searchesLeft }

  const show_market_price = checkFeatureAccess({
    ...featureBase,
    enabled: s['yad2_market_enabled'] ?? '1',
    publicOn: s['yad2_market_public'] ?? '0',
    publicStart: s['yad2_market_public_start'] ?? '',
    publicEnd: s['yad2_market_public_end'] ?? '',
  })

  const show_watches = checkFeatureAccess({
    ...featureBase,
    enabled: s['yad2_watch_enabled'] ?? '1',
    publicOn: s['yad2_watch_public'] ?? '0',
    publicStart: s['yad2_watch_public_start'] ?? '',
    publicEnd: s['yad2_watch_public_end'] ?? '',
  })

  const show_pdf_report = checkFeatureAccess({
    ...featureBase,
    enabled: s['pdf_report_enabled'] ?? '1',
    publicOn: s['pdf_report_public'] ?? '0',
    publicStart: s['pdf_report_public_start'] ?? '',
    publicEnd: s['pdf_report_public_end'] ?? '',
  })

  const watch_max = parseInt(s['yad2_watch_max'] ?? '3') || 3

  return ok({
    ...user,
    searches_left: searchesLeft,
    is_subscriber: isSubscriber,
    is_admin: isAdmin,
    show_market_price,
    show_watches,
    show_pdf_report,
    watch_max,
    market_public_label: s['yad2_market_public_label'] ?? '',
    watch_public_label: s['yad2_watch_public_label'] ?? '',
    pdf_public_label: s['pdf_report_public_label'] ?? '',
  })
}
