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
  verifyOtp: (email: string, code: string, ref?: string) => req<{ token: string; user: User }>('POST', '/auth-otp-verify', { email, code, ref }),
  googleLogin: (id_token: string) => req<{ token: string; user: User }>('POST', '/auth-google', { id_token }),

  // User
  getUser: () => req<User>('GET', '/user'),

  // Vehicle
  lookupPlate: (plate: string) => req<VehicleData>('GET', `/vehicle?plate=${plate}`),

  // History
  getHistory: () => req<HistoryItem[]>('GET', '/history'),

  // Market price
  getMarketPrice: (manufacturer: string, model: string, year?: string) =>
    req<MarketPrice>('GET', `/market-price?manufacturer=${encodeURIComponent(manufacturer)}&model=${encodeURIComponent(model)}${year ? `&year=${year}` : ''}`),

  // Notes
  getNote: (plate: string) => req<{ note: string }>('GET', `/notes?plate=${plate}`),
  saveNote: (plate: string, note: string) => req('POST', `/notes?plate=${plate}`, { note }),

  // Packages
  getPackages: () => req<Package[]>('GET', '/packages'),

  // Payment
  initiatePayment: (package_id: string, quantity?: number) =>
    req<{ ref: string; approval_url: string; label: string; price: number; searches: number; manual?: boolean }>('POST', '/payment/initiate', { package_id, quantity }),
  checkPaymentStatus: (ref: string) =>
    req<{ status: string; completed: boolean }>('GET', `/payment/status?ref=${ref}`),
  cancelPayment: (ref: string) => req('POST', '/payment/cancel', { ref }),

  // Access codes
  applyCode: (code: string) => req<{ ok: boolean; searches: number; unlimited: boolean; message: string }>('POST', '/apply-code', { code }),

  // Referral
  getReferralLink: () => req<{ link: string; referral_code: string }>('GET', '/referral/link'),
  getReferralStats: () => req<{ total_referrals: number; total_bonus: number; referrals: ReferralItem[] }>('GET', '/referral/stats'),

  // Watches
  getWatches: () => req<WatchItem[]>('GET', '/watches'),
  addWatch: (make: string, model?: string, year?: number) => req('POST', '/watches', { make, model, year }),
  removeWatch: (id: number) => req('DELETE', `/watches/${id}`),
  toggleWatch: (id: number) => req<{ active: boolean }>('PATCH', `/watches/${id}/toggle`),

  // Tickets
  getTickets: () => req<Ticket[]>('GET', '/tickets'),
  createTicket: (subject: string, message: string) => req<{ id: string }>('POST', '/tickets', { subject, message }),
  getTicket: (id: string) => req<TicketDetail>('GET', `/tickets/${id}`),
  replyToTicket: (id: string, message: string) => req('POST', `/tickets/${id}/reply`, { message }),
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
  show_pdf_report: boolean
  show_market_price: boolean
  show_watches: boolean
  pdf_public_label?: string
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

export interface MarketPrice {
  prices: { avg: number; min: number; max: number; count: number; median?: number; avg_km?: number | null } | null
  total_on_road: number
}

export interface Package {
  id: string
  label: string
  searches: number
  price: number
}

export interface Ticket {
  id: string
  subject: string
  status: string
  message: string
  created_at: string
}

export interface TicketReply {
  id: string
  sender_name: string
  is_admin: number
  message: string
  created_at: string
}

export interface TicketDetail extends Ticket {
  replies: TicketReply[]
}

export interface WatchItem {
  id: number
  make: string
  model: string
  year: number | null
  active: boolean
  created_at: string
}

export interface ReferralItem {
  referee_email: string
  bonus: number
  joined_at: string
}
