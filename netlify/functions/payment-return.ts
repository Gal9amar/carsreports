import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  const ref = event.queryStringParameters?.ref || ''
  return {
    statusCode: 302,
    headers: { Location: `/?payment=success&ref=${ref}` },
    body: '',
  }
}
