import jwt from 'jsonwebtoken'
import { db } from './db'
import { randomUUID } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET!
const SESSION_DAYS = 30

export function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` })
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string }
  } catch {
    return null
  }
}

export async function getUserFromRequest(headers: Record<string, string | undefined>) {
  const auth = headers['authorization'] || headers['Authorization']
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const payload = verifyToken(token)
  if (!payload) return null

  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [payload.sub],
  })
  return result.rows[0] ?? null
}

export async function createSession(userId: string) {
  const token = generateToken(userId)
  const expires = new Date()
  expires.setDate(expires.getDate() + SESSION_DAYS)

  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    args: [randomUUID(), userId, token, expires.toISOString()],
  })
  return token
}

export function ok(body: unknown, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  }
}

export function err(message: string, status = 400) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message }),
  }
}

export function cors() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: '',
  }
}
