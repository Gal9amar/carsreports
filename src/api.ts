const BASE = '/api'

function getToken() {
  return localStorage.getItem('cr_token')
}

function headers() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'שגיאה לא צפויה')
  return data as T
}

export const api = {
  // Auth
  sendOtp: (email: string) => req('POST', '/auth-otp-send', { email }),
  verifyOtp: (email: string, code: string) => req<{ token: string; user: User }>('POST', '/auth-otp-verify', { email, code }),
  googleLogin: (id_token: string) => req<{ token: string; user: User }>('POST', '/auth-google', { id_token }),

  // User
  getUser: () => req<User>('GET', '/user'),

  // Vehicle
  lookupPlate: (plate: string) => req<VehicleData>('GET', `/vehicle?plate=${plate}`),

  // History
  getHistory: () => req<HistoryItem[]>('GET', '/history'),

  // Packages
  getPackages: () => req<Package[]>('GET', '/packages'),

  // Payment
  initiatePayment: (package_id: string) => req<{ ref: string; paypal_url: string }>('POST', '/payment/initiate', { package_id }),
  confirmPayment: (ref: string) => req('POST', '/payment/confirm', { ref }),
}

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  searches_done: number
  searches_quota: number
  searches_left: number
  is_subscriber: boolean
  is_admin: boolean
  blocked: number
}

export interface VehicleData {
  [key: string]: unknown
  mispar_rechev?: string
  degem_nm?: string
  tozeret_nm?: string
  shnat_yitzur?: number
  tzeva_rechev?: string
  sug_delek_nm?: string
  kinuy_mishari?: string
}

export interface HistoryItem {
  plate: string
  searched_at: string
}

export interface Package {
  id: string
  label: string
  searches: number
  price: number
}
