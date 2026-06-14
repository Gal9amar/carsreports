import type { Handler } from '@netlify/functions'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { db } from './lib/db'

const SITE_URL = process.env.URL || 'https://carsreports.netlify.app'

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const user = await getUserFromRequest(event.headers as Record<string, string | undefined>)
  if (!user) return err('Unauthorized', 401)

  const path = (event.rawUrl || event.path || '')
    .replace(/^.*\/referral/, '')
    .replace(/\?.*$/, '')

  if (event.httpMethod === 'GET' && path === '/link') {
    const code = (user.id as string).slice(0, 8)
    const link = `${SITE_URL}?ref=${code}`
    return ok({ link, referral_code: code })
  }

  if (event.httpMethod === 'GET' && path === '/stats') {
    const result = await db.execute({
      sql: `SELECT u.email AS referee_email, r.bonus, r.joined_at
            FROM referrals r
            JOIN users u ON u.id = r.referee_id
            WHERE r.referrer_id = ?
            ORDER BY r.joined_at DESC`,
      args: [user.id as string],
    })
    const referrals = result.rows.map(r => ({
      referee_email: r.referee_email as string,
      bonus: r.bonus as number,
      joined_at: r.joined_at as string,
    }))
    const total_referrals = referrals.length
    const total_bonus = referrals.reduce((sum, r) => sum + r.bonus, 0)
    return ok({ total_referrals, total_bonus, referrals })
  }

  return err('Not found', 404)
}
