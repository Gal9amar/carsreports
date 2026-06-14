import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ ok: true, ts: new Date().toISOString() }),
})
