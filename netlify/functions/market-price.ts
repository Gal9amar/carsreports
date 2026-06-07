import type { Handler } from '@netlify/functions'
import { getUserFromRequest, ok, err, cors } from './lib/auth'

const WORKER = process.env.YAD2_CF_WORKER_URL || ''

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET') return err('Method not allowed', 405)

  const user = await getUserFromRequest(event.headers as Record<string, string>)
  if (!user) return err('לא מחובר', 401)

  const { manufacturer, model, year } = event.queryStringParameters || {}
  if (!manufacturer && !model) return err('חסרים פרטים')

  try {
    // Fetch lookalike (market price)
    const lookalike = await fetchWorker('lookalike', manufacturer, model, year)
    const prices = extractPrices(lookalike)

    // Fetch count on road (feed with rows=1 just for total)
    const feed = await fetchWorker('feed', manufacturer, model, year, '1')
    const total = feed?.total ?? 0

    return ok({ prices, total_on_road: total })
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'שגיאה בשליפת מחיר שוק', 500)
  }
}

async function fetchWorker(type: string, manufacturer?: string, model?: string, year?: string, rows = '50') {
  const params = new URLSearchParams({ type, rows })
  if (manufacturer) params.set('manufacturer', manufacturer)
  if (model) params.set('model', model)
  if (year) params.set('year', year)
  const res = await fetch(`${WORKER}?${params}`)
  if (!res.ok) return null
  return res.json() as Promise<Record<string, unknown>>
}

function extractPrices(data: Record<string, unknown> | null): { avg: number; min: number; max: number; count: number } | null {
  if (!data) return null
  try {
    // lookalike response structure
    const items = (data?.data as Record<string, unknown>)
    if (!items) return null

    const stats = (items as Record<string, unknown>)
    const avg = Number((stats as Record<string, unknown>).price_average ?? (stats as Record<string, unknown>).avgPrice ?? 0)
    const min = Number((stats as Record<string, unknown>).price_min ?? (stats as Record<string, unknown>).minPrice ?? 0)
    const max = Number((stats as Record<string, unknown>).price_max ?? (stats as Record<string, unknown>).maxPrice ?? 0)
    const count = Number((stats as Record<string, unknown>).total ?? (stats as Record<string, unknown>).count ?? 0)

    if (avg > 0) return { avg, min, max, count }

    // Fallback: calculate from items array
    const arr = Array.isArray(data?.data) ? data.data as Record<string, unknown>[] : []
    if (!arr.length) return null
    const priceArr = arr.map(i => Number(i.price ?? i.Price ?? 0)).filter(p => p > 0)
    if (!priceArr.length) return null
    return {
      avg: Math.round(priceArr.reduce((a, b) => a + b, 0) / priceArr.length),
      min: Math.min(...priceArr),
      max: Math.max(...priceArr),
      count: priceArr.length,
    }
  } catch { return null }
}
