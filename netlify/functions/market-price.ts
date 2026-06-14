import type { Handler } from '@netlify/functions'
import { getUserFromRequest, ok, err, cors } from './lib/auth'
import { getManufacturerId, getModelId } from './lib/yad2'

const PROXY_URL = process.env.YAD2_PROXY_URL || ''
const PROXY_SECRET = process.env.YAD2_PROXY_SECRET || ''

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405)

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const { manufacturer, model, year } = event.queryStringParameters || {}
  if (!manufacturer) return err('חסר יצרן')

  const mfrId = getManufacturerId(manufacturer)
  if (!mfrId) {
    console.log('[market-price] unknown manufacturer:', manufacturer)
    return ok({ prices: null, total_on_road: 0 })
  }

  const modelId = model ? getModelId(mfrId, model) : null
  console.log(`[market-price] make="${manufacturer}" mfrId=${mfrId} model="${model}" modelId=${modelId}`)

  try {
    // First try: manufacturer + model (specific)
    let items = await proxyFetch(mfrId, modelId ?? undefined, year)

    // Fallback: manufacturer only if too few results
    if (items.length <= 3 && modelId) {
      console.log(`[market-price] few results (${items.length}), retrying without model`)
      const broader = await proxyFetch(mfrId, undefined, year)
      if (broader.length > items.length) items = broader
    }

    if (!items.length) return ok({ prices: null, total_on_road: 0 })

    // Filter by year if provided
    let filtered = items
    if (year) {
      const y = parseInt(year)
      const byYear = items.filter(i => {
        const iy = Number((i as Record<string, unknown>)?.vehicleDates
          ? ((i as Record<string, unknown>).vehicleDates as Record<string, unknown>)?.yearOfProduction
          : 0)
        return iy === y
      })
      if (byYear.length > 0) filtered = byYear
    }

    const rawPrices = filtered
      .map(i => Number((i as Record<string, unknown>).price ?? 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b)

    if (!rawPrices.length) return ok({ prices: null, total_on_road: items.length })

    // IQR outlier removal: discard prices outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
    const q1 = rawPrices[Math.floor(rawPrices.length * 0.25)]
    const q3 = rawPrices[Math.floor(rawPrices.length * 0.75)]
    const iqr = q3 - q1
    const lo = q1 - 1.5 * iqr
    const hi = q3 + 1.5 * iqr
    const prices = rawPrices.filter(p => p >= lo && p <= hi)
    const clean = prices.length >= 3 ? prices : rawPrices

    const kms = filtered
      .map(i => Number((i as Record<string, unknown>).km ?? 0))
      .filter(k => k > 0)
    const avg_km = kms.length ? Math.round(kms.reduce((a, b) => a + b, 0) / kms.length) : null

    return ok({
      prices: {
        avg: Math.round(clean.reduce((a, b) => a + b, 0) / clean.length),
        min: clean[0],
        max: clean[clean.length - 1],
        median: clean[Math.floor(clean.length / 2)],
        count: clean.length,
        avg_km,
      },
      total_on_road: items.length,
    })
  } catch (e: unknown) {
    console.error('[market-price] error:', e)
    return err(e instanceof Error ? e.message : 'שגיאה', 500)
  }
}

async function proxyFetch(mfrId: number, modelId?: number, year?: string): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams({
    secret: PROXY_SECRET,
    manufacturer: String(mfrId),
    rows: '100',
  })
  if (modelId) qs.set('model', String(modelId))
  if (year) {
    const y = parseInt(year)
    if (!isNaN(y)) qs.set('year', `${y}-${y}`)
  }
  const url = `${PROXY_URL}?${qs}`
  console.log('[market-price] proxy URL:', url)
  const res = await fetch(url)
  const text = await res.text()
  console.log('[market-price] status:', res.status, 'preview:', text.slice(0, 200))
  if (!res.ok) return []
  const data = JSON.parse(text) as { data?: Record<string, unknown>[] }
  return Array.isArray(data?.data) ? data.data : []
}
