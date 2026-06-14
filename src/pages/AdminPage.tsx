import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/admin'

function adminReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem('cr_token')
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'שגיאה')
    return d
  })
}

type Tab = 'stats' | 'users' | 'payments' | 'packages' | 'codes' | 'settings' | 'broadcast' | 'activity' | 'tickets'

interface Stats { total_users: number; subscribers: number; pending_payments: number; total_searches: number }
interface UserRow { id: string; email: string; full_name: string; searches_done: number; searches_quota: number; searches_left: number; is_subscriber: number; is_admin: number; blocked: number; created_at: string }
interface PaymentRow { ref: string; user_id: string; searches: number; price: number; label: string; status: string; created_at: string; updated_at: string | null; email: string; is_pending: number }
interface PkgRow { id: number; label: string; searches: number; price: number }
interface CodeRow { code: string; searches: number; unlimited: number; single_use: number; expires: string | null; used_by: string | null; uses: number; created: string }
interface ActivityRow { action: string; description: string; created_at: string; email: string }
interface TicketRow { id: string; subject: string; status: string; email: string; created_at: string; full_name: string }

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  blue: '#2563eb',
  indigo: '#6366f1',
  gradient: 'linear-gradient(135deg, #2563eb, #6366f1)',
  pageBg: '#f0f4ff',
  card: '#ffffff',
  border: '#e0e7ff',
  muted: '#6b7280',
  fg: '#111827',
  tableHeader: '#f8faff',
}

const card: React.CSSProperties = {
  background: C.card,
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: `1.5px solid ${C.border}`,
  padding: 24,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  background: C.tableHeader,
  padding: '10px 14px',
  textAlign: 'right',
  fontWeight: 700,
  color: C.muted,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: `1.5px solid ${C.border}`,
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: `1px solid ${C.border}`,
  color: C.fg,
  verticalAlign: 'middle',
}

function btnBase(variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success', size: 'sm' | 'md' = 'md'): React.CSSProperties {
  const pad = size === 'sm' ? '5px 12px' : '9px 20px'
  const fs = size === 'sm' ? 12 : 14
  const base: React.CSSProperties = {
    padding: pad, fontSize: fs, fontWeight: 700, borderRadius: 8, border: 'none',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
    transition: 'opacity .15s',
  }
  if (variant === 'primary') return { ...base, background: C.gradient, color: '#fff', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }
  if (variant === 'danger')  return { ...base, background: '#fee2e2', color: '#dc2626' }
  if (variant === 'success') return { ...base, background: '#dcfce7', color: '#16a34a' }
  if (variant === 'ghost')   return { ...base, background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
  return { ...base, background: C.border, color: C.blue }
}

function badge(color: 'green' | 'red' | 'blue' | 'yellow' | 'orange' | 'indigo' | 'gray'): React.CSSProperties {
  const map: Record<string, [string, string]> = {
    green:  ['#dcfce7', '#16a34a'],
    red:    ['#fee2e2', '#dc2626'],
    blue:   ['#dbeafe', '#2563eb'],
    yellow: ['#fef9c3', '#ca8a04'],
    orange: ['#ffedd5', '#ea580c'],
    indigo: ['#e0e7ff', '#6366f1'],
    gray:   ['#f3f4f6', '#6b7280'],
  }
  const [bg, fg] = map[color] || map.gray
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg, color: fg,
    borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 700,
    whiteSpace: 'nowrap',
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.border}`,
  borderRadius: 8, fontSize: 14, color: C.fg, background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: C.muted,
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4,
}

// ── Main component ─────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [packages, setPackages] = useState<PkgRow[]>([])
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    setMsg('')
    try {
      if (t === 'stats')    setStats(await adminReq('GET', '/stats'))
      else if (t === 'users')    setUsers(await adminReq('GET', '/users'))
      else if (t === 'payments') setPayments(await adminReq('GET', '/payments'))
      else if (t === 'packages') setPackages(await adminReq('GET', '/packages'))
      else if (t === 'codes')    setCodes(await adminReq('GET', '/codes'))
      else if (t === 'activity') setActivity(await adminReq('GET', '/activity'))
      else if (t === 'tickets')  setTickets(await adminReq('GET', '/tickets'))
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'stats',    label: 'סטטיסטיקות', icon: '📊' },
    { key: 'users',    label: 'משתמשים',    icon: '👥' },
    { key: 'payments', label: 'תשלומים',    icon: '💳' },
    { key: 'packages', label: 'חבילות',     icon: '📦' },
    { key: 'codes',    label: 'קודי גישה',  icon: '🎟️' },
    { key: 'settings', label: 'הגדרות',     icon: '⚙️' },
    { key: 'broadcast',label: 'שידור',      icon: '📢' },
    { key: 'activity', label: 'פעילות',     icon: '📋' },
    { key: 'tickets',  label: 'טיקטים',     icon: '🎫' },
  ]

  return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '24px 20px', direction: 'rtl' }}>
      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap',
        background: '#fff', borderRadius: 14, padding: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', border: `1.5px solid ${C.border}`,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: tab === t.key ? C.gradient : 'transparent',
              color: tab === t.key ? '#fff' : C.muted,
              boxShadow: tab === t.key ? '0 2px 8px rgba(37,99,235,0.22)' : 'none',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ ...card, background: '#fee2e2', border: '1.5px solid #fca5a5', color: '#dc2626', padding: '12px 18px', marginBottom: 16, fontWeight: 600 }}>
          {msg}
        </div>
      )}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────── */}
      {tab === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
          {[
            { label: 'משתמשים רשומים', value: stats.total_users,      icon: '👥', color: '#2563eb' },
            { label: 'מנויים פעילים',   value: stats.subscribers,      icon: '⭐', color: '#6366f1' },
            { label: 'תשלומים ממתינים', value: stats.pending_payments, icon: '💳', color: '#f59e0b' },
            { label: 'סה"כ חיפושים',   value: stats.total_searches,   icon: '🔍', color: '#10b981' },
          ].map(s => (
            <div key={s.label} style={{
              ...card, padding: 0, overflow: 'hidden',
              borderTop: `4px solid ${s.color}`,
            }}>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: s.color, letterSpacing: -1, lineHeight: 1 }}>
                  {Number(s.value).toLocaleString('he-IL')}
                </div>
                <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginTop: 6 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Users ─────────────────────────────────────────── */}
      {tab === 'users' && (
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['משתמש', 'שם', 'חיפושים', 'מנוי', 'מנהל', 'חסום', 'פעולות'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: C.gradient, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14,
                      }}>
                        {(u.email || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.email}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{u.full_name || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: C.blue }}>{u.searches_done}</span>
                    <span style={{ color: C.muted }}> / {u.searches_quota === -1 ? '∞' : u.searches_quota}</span>
                  </td>
                  <td style={tdStyle}>{u.is_subscriber ? <span style={badge('indigo')}>מנוי</span> : <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={tdStyle}>{u.is_admin ? <span style={badge('blue')}>מנהל</span> : <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={tdStyle}>{u.blocked ? <span style={badge('red')}>חסום</span> : <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <GrantButton userId={u.id} onDone={() => load('users')} />
                      <button
                        style={btnBase(u.blocked ? 'success' : 'danger', 'sm')}
                        onClick={async () => {
                          await adminReq('POST', `/users/${u.id}/${u.blocked ? 'unblock' : 'block'}`)
                          load('users')
                        }}
                      >
                        {u.blocked ? 'בטל חסימה' : 'חסום'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payments ─────────────────────────────────────── */}
      {tab === 'payments' && (
        <div style={{ ...card, padding: 0, overflow: 'auto', width: '100%' }}>
          {payments.length === 0 && <p style={{ padding: 20, color: C.muted }}>אין תשלומים</p>}
          <table style={tableStyle}>
            <thead>
              <tr>
                {['מזהה עסקה', 'משתמש', 'חבילה', 'מחיר', 'סטטוס', 'תאריך', 'פעולות'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.ref}
                  style={{ opacity: p.is_pending ? 1 : 0.72, transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>{p.ref}</td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>{p.email || p.user_id}</td>
                  <td style={tdStyle}>{p.label}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: C.blue }}>₪{p.price}</td>
                  <td style={tdStyle}><PaymentStatusBadge status={p.status} /></td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString('he-IL')}</td>
                  <td style={tdStyle}>
                    {p.is_pending ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={btnBase('primary', 'sm')}
                          onClick={async () => { await adminReq('POST', `/payments/${p.ref}/approve`); load('payments') }}>
                          ✅ אשר
                        </button>
                        <button style={btnBase('danger', 'sm')}
                          onClick={async () => { await adminReq('POST', `/payments/${p.ref}/decline`); load('payments') }}>
                          ❌ דחה
                        </button>
                      </div>
                    ) : <span style={{ color: C.muted, fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Packages ─────────────────────────────────────── */}
      {tab === 'packages' && <PackagesManager packages={packages} onRefresh={() => load('packages')} />}

      {/* ── Codes ────────────────────────────────────────── */}
      {tab === 'codes' && <CodesManager codes={codes} onRefresh={() => load('codes')} />}

      {/* ── Settings ─────────────────────────────────────── */}
      {tab === 'settings' && <SettingsPanel />}

      {/* ── Broadcast ────────────────────────────────────── */}
      {tab === 'broadcast' && <BroadcastPanel />}

      {/* ── Tickets ──────────────────────────────────────── */}
      {tab === 'tickets' && <AdminTicketsPanel tickets={tickets} onRefresh={() => load('tickets')} />}

      {/* ── Activity ─────────────────────────────────────── */}
      {tab === 'activity' && (
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['פעולה', 'תיאור', 'משתמש', 'תאריך'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.map((a, i) => (
                <tr key={i}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={tdStyle}><span style={{ ...badge('blue'), fontSize: 11 }}>{a.action}</span></td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>{a.description}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{a.email || '—'}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── PaymentStatusBadge ─────────────────────────────────────────────
function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'gray' }> = {
    created:        { label: 'נוצר',          color: 'blue' },
    approved:       { label: 'אושר',          color: 'yellow' },
    captured:       { label: 'נלכד',          color: 'blue' },
    completed:      { label: 'הושלם ✅',      color: 'green' },
    admin_approved: { label: 'אושר ידנית ✅', color: 'green' },
    declined:       { label: 'נדחה ❌',       color: 'red' },
    failed:         { label: 'נכשל ❌',       color: 'red' },
    user_cancelled: { label: 'בוטל',          color: 'orange' },
    pending:        { label: 'ממתין',         color: 'yellow' },
  }
  const s = map[status] || { label: status, color: 'gray' as const }
  return <span style={badge(s.color)}>{s.label}</span>
}

// ── GrantButton ────────────────────────────────────────────────────
function GrantButton({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [searches, setSearches] = useState('')
  const [loading, setLoading] = useState(false)

  async function grant() {
    if (!searches) return
    setLoading(true)
    await adminReq('POST', `/users/${userId}/grant`, { searches: Number(searches) })
    setOpen(false)
    setSearches('')
    setLoading(false)
    onDone()
  }

  if (!open) return (
    <button style={btnBase('secondary', 'sm')} onClick={() => setOpen(true)}>+ חיפושים</button>
  )

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input
        type="number" min="1" max="9999" value={searches}
        onChange={e => setSearches(e.target.value)}
        placeholder="כמות"
        style={{ width: 70, padding: '4px 8px', border: `1.5px solid ${C.border}`, borderRadius: 6, fontSize: 13 }}
      />
      <button style={btnBase('primary', 'sm')} onClick={grant} disabled={loading}>✅</button>
      <button style={btnBase('ghost', 'sm')} onClick={() => setOpen(false)}>✕</button>
    </div>
  )
}

// ── PackagesManager ────────────────────────────────────────────────
function PackagesManager({ packages, onRefresh }: { packages: PkgRow[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ label: '', searches: '', price: '' })
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ label: '', searches: '', price: '' })

  async function addPkg() {
    setLoading(true)
    await adminReq('POST', '/packages', { label: form.label, searches: Number(form.searches), price: Number(form.price) })
    setForm({ label: '', searches: '', price: '' })
    setLoading(false)
    onRefresh()
  }

  async function savePkg(id: number) {
    await adminReq('PUT', `/packages/${id}`, { label: editForm.label, searches: Number(editForm.searches), price: Number(editForm.price) })
    setEditingId(null)
    onRefresh()
  }

  return (
    <div>
      {/* Packages card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16, marginBottom: 24 }}>
        {packages.map(p => (
          editingId === p.id ? (
            <div key={p.id} style={{ ...card, borderTop: `4px solid ${C.indigo}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>שם חבילה</label>
                  <input style={inputStyle} value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>חיפושים</label>
                  <input style={inputStyle} type="number" value={editForm.searches} onChange={e => setEditForm(f => ({ ...f, searches: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>מחיר (₪)</label>
                  <input style={inputStyle} type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnBase('primary', 'sm')} onClick={() => savePkg(p.id)}>שמור</button>
                  <button style={btnBase('ghost', 'sm')} onClick={() => setEditingId(null)}>ביטול</button>
                </div>
              </div>
            </div>
          ) : (
            <div key={p.id} style={{ ...card, borderTop: `4px solid ${C.blue}` }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.fg, marginBottom: 8 }}>{p.label}</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <span style={badge('blue')}>🔍 {p.searches === -1 ? 'ללא הגבלה' : p.searches} חיפושים</span>
                <span style={badge('indigo')}>₪{p.price}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnBase('secondary', 'sm')} onClick={() => {
                  setEditingId(p.id)
                  setEditForm({ label: p.label, searches: String(p.searches), price: String(p.price) })
                }}>ערוך</button>
                <button style={btnBase('danger', 'sm')} onClick={async () => { await adminReq('DELETE', `/packages/${p.id}`); onRefresh() }}>מחק</button>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Add new package form */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.fg, marginBottom: 16 }}>הוסף חבילה חדשה</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>שם</label>
            <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="50 חיפושים" />
          </div>
          <div>
            <label style={labelStyle}>חיפושים</label>
            <input style={inputStyle} type="number" value={form.searches} onChange={e => setForm(f => ({ ...f, searches: e.target.value }))} placeholder="50" />
          </div>
          <div>
            <label style={labelStyle}>מחיר (₪)</label>
            <input style={inputStyle} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="10" />
          </div>
          <button style={btnBase('primary')} onClick={addPkg} disabled={loading || !form.label}>הוסף</button>
        </div>
      </div>
    </div>
  )
}

// ── CodesManager ───────────────────────────────────────────────────
function CodesManager({ codes, onRefresh }: { codes: CodeRow[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ code: '', searches: '', unlimited: false, single_use: true, expires: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm(f => ({ ...f, code: `${part(4)}-${part(4)}` }))
  }

  async function addCode() {
    if (!form.code.trim()) return
    setLoading(true)
    setMsg('')
    try {
      await adminReq('POST', '/codes', {
        code: form.code.trim(),
        searches: form.unlimited ? 0 : Number(form.searches),
        unlimited: form.unlimited,
        single_use: form.single_use,
        expires: form.expires || null,
      })
      setForm({ code: '', searches: '', unlimited: false, single_use: true, expires: '' })
      onRefresh()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    setLoading(false)
  }

  return (
    <div>
      <div style={{ ...card, padding: 0, overflow: 'auto', marginBottom: 20 }}>
        {codes.length === 0 ? (
          <p style={{ padding: 20, color: C.muted }}>אין קודי גישה</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['קוד', 'סוג', 'שימוש יחיד', 'נוצל', 'תפוגה', 'פעולות'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.code}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1, fontWeight: 700, color: C.blue }}>{c.code}</td>
                  <td style={tdStyle}>
                    {c.unlimited
                      ? <span style={badge('indigo')}>♾️ מנוי</span>
                      : <span style={badge('blue')}>🔍 {c.searches} חיפושים</span>
                    }
                  </td>
                  <td style={tdStyle}>{c.single_use
                    ? <span style={badge('green')}>✅ כן</span>
                    : <span style={badge('gray')}>🔁 רב-שימוש</span>}
                  </td>
                  <td style={tdStyle}>
                    {c.used_by
                      ? <span style={badge('red')}>נוצל ({c.uses})</span>
                      : <span style={{ color: C.muted }}>{c.uses} שימושים</span>
                    }
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{c.expires ? new Date(c.expires).toLocaleDateString('he-IL') : '—'}</td>
                  <td style={tdStyle}>
                    <button style={btnBase('danger', 'sm')} onClick={async () => { await adminReq('DELETE', `/codes/${c.code}`); onRefresh() }}>מחק</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.fg, marginBottom: 18 }}>צור קוד גישה חדש</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>קוד</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', letterSpacing: 1 }}
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="XXXX-YYYY"
                dir="ltr"
              />
              <button style={btnBase('secondary', 'sm')} onClick={generateCode}>🎲 צור</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>חיפושים</label>
            <input style={inputStyle} type="number" value={form.searches}
              onChange={e => setForm(f => ({ ...f, searches: e.target.value }))}
              disabled={form.unlimited} placeholder="10" />
          </div>
          <div>
            <label style={labelStyle}>תאריך תפוגה (אופציונלי)</label>
            <input style={inputStyle} type="date" value={form.expires} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', paddingTop: 22 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.fg }}>
              <input type="checkbox" checked={form.unlimited} onChange={e => setForm(f => ({ ...f, unlimited: e.target.checked }))} />
              מנוי חודשי
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.fg }}>
              <input type="checkbox" checked={form.single_use} onChange={e => setForm(f => ({ ...f, single_use: e.target.checked }))} />
              שימוש יחיד
            </label>
          </div>
        </div>
        {msg && <p style={{ color: '#dc2626', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>{msg}</p>}
        <button style={btnBase('primary')} onClick={addCode} disabled={loading || !form.code.trim()}>
          {loading ? 'יוצר...' : '➕ צור קוד'}
        </button>
      </div>
    </div>
  )
}

// ── SettingsPanel ──────────────────────────────────────────────────
function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [giftSearches, setGiftSearches] = useState('10')
  const [giftLoading, setGiftLoading] = useState(false)

  useEffect(() => {
    adminReq<Record<string, string>>('GET', '/settings').then(s => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      await adminReq('POST', '/settings', settings)
      setMsg('✅ הגדרות נשמרו')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    setSaving(false)
  }

  async function giftAll() {
    if (!confirm(`לתת ${giftSearches} חיפושים לכל המשתמשים?`)) return
    setGiftLoading(true)
    try {
      const res = await adminReq<{ count: number }>('POST', '/gift-all', { searches: Number(giftSearches) })
      setMsg(`✅ נשלחו ${giftSearches} חיפושים ל-${res.count} משתמשים`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    setGiftLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  const SETTINGS_FIELDS: { key: string; label: string; type?: string }[] = [
    { key: 'free_searches',  label: 'חיפושים חינם למשתמש חדש',           type: 'number' },
    { key: 'referral_bonus', label: 'בונוס חיפושים לפניה (referral)',    type: 'number' },
    { key: 'maintenance',    label: 'מצב תחזוקה (0/1)',                  type: 'number' },
    { key: 'paypal_me',      label: 'קישור PayPal.me (גיבוי)' },
    { key: 'admin_email',    label: 'מייל מנהל' },
    { key: 'promo_searches', label: 'חיפושים במבצע (promo)',             type: 'number' },
    { key: 'promo_start',    label: 'תחילת מבצע (ISO date)' },
    { key: 'promo_end',      label: 'סיום מבצע (ISO date)' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1.5px solid ${C.border}` }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.fg }}>הגדרות מערכת</span>
        </div>
        {SETTINGS_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{f.label}</label>
            <input
              style={inputStyle}
              type={f.type || 'text'}
              value={settings[f.key] ?? ''}
              onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
              dir="ltr"
            />
          </div>
        ))}
        {msg && (
          <p style={{ color: msg.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: 12, fontSize: 14, fontWeight: 600 }}>{msg}</p>
        )}
        <button style={btnBase('primary')} onClick={save} disabled={saving}>
          {saving ? 'שומר...' : '💾 שמור הגדרות'}
        </button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: `1.5px solid ${C.border}` }}>
          <span style={{ fontSize: 22 }}>🎁</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.fg }}>מתנה לכל המשתמשים</span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          הוסף חיפושים לכל המשתמשים הפעילים (לא חסומים) בבת אחת
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>מספר חיפושים</label>
          <input style={inputStyle} type="number" min="1" max="9999" value={giftSearches}
            onChange={e => setGiftSearches(e.target.value)} dir="ltr" />
        </div>
        <button style={btnBase('secondary')} onClick={giftAll} disabled={giftLoading}>
          {giftLoading ? 'שולח...' : `🎁 תן ${giftSearches} חיפושים לכולם`}
        </button>
      </div>
    </div>
  )
}

// ── AdminTicketsPanel ──────────────────────────────────────────────
function AdminTicketsPanel({ tickets, onRefresh }: { tickets: TicketRow[]; onRefresh: () => void }) {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [thread, setThread] = useState<{ subject: string; status: string; email: string; message: string; replies: { id: string; sender_name: string; is_admin: number; message: string; created_at: string }[] } | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  async function openThread(id: string) {
    setThreadId(id)
    setThreadLoading(true)
    setMsg('')
    try {
      const data = await adminReq<typeof thread>('GET', `/tickets/${id}`)
      setThread(data)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    setThreadLoading(false)
  }

  async function sendReply() {
    if (!replyText.trim() || !threadId) return
    setSubmitting(true)
    setMsg('')
    try {
      await adminReq('POST', `/tickets/${threadId}/reply`, { message: replyText.trim() })
      setReplyText('')
      await openThread(threadId)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'שגיאה') }
    setSubmitting(false)
  }

  async function setStatus(id: string, action: 'open' | 'close') {
    await adminReq('POST', `/tickets/${id}/${action}`)
    if (threadId === id && thread) {
      setThread({ ...thread, status: action === 'close' ? 'closed' : 'open' })
    }
    onRefresh()
  }

  if (threadId && thread) {
    return (
      <div>
        <button style={{ ...btnBase('ghost'), marginBottom: 16 }} onClick={() => { setThreadId(null); setThread(null) }}>
          ← חזרה לרשימה
        </button>
        <div style={{ ...card, maxWidth: 700 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingBottom: 12, borderBottom: `1.5px solid ${C.border}` }}>
            <h3 style={{ fontWeight: 800, margin: 0, fontSize: 18, color: C.fg }}>{thread.subject}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={badge(thread.status === 'open' ? 'green' : 'red')}>
                {thread.status === 'open' ? 'פתוח' : 'סגור'}
              </span>
              {thread.status === 'open'
                ? <button style={btnBase('danger', 'sm')} onClick={() => setStatus(threadId, 'close')}>סגור</button>
                : <button style={btnBase('secondary', 'sm')} onClick={() => setStatus(threadId, 'open')}>פתח מחדש</button>
              }
            </div>
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>מאת: {thread.email}</p>

          {threadLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.blue, animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {msg && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
              <div style={{ background: C.gradient, color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', fontSize: 14 }}>
                {thread.message}
              </div>
            </div>
            {thread.replies.map(r => (
              <div key={r.id} style={{ alignSelf: r.is_admin ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
                <div style={{
                  background: r.is_admin ? '#f8faff' : C.gradient,
                  color: r.is_admin ? C.fg : '#fff',
                  border: r.is_admin ? `1.5px solid ${C.border}` : 'none',
                  borderRadius: r.is_admin ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                  padding: '10px 14px', fontSize: 14,
                }}>
                  {r.is_admin && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{r.sender_name}</div>}
                  {r.message}
                </div>
                <div style={{ fontSize: 11, color: C.muted, textAlign: r.is_admin ? 'left' : 'right', marginTop: 4 }}>
                  {new Date(r.created_at).toLocaleString('he-IL')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              style={{ ...inputStyle, flex: 1, resize: 'none', fontFamily: 'inherit' }}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={2}
              placeholder="כתוב תגובה כמנהל..."
            />
            <button style={{ ...btnBase('primary'), alignSelf: 'flex-end' }} onClick={sendReply} disabled={submitting || !replyText.trim()}>
              {submitting ? '...' : 'שלח'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Tickets list view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tickets.length === 0 ? (
        <div style={{ ...card, color: C.muted, textAlign: 'center', padding: 40 }}>אין טיקטים</div>
      ) : tickets.map(t => (
        <div key={t.id} style={{ ...card, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={badge(t.status === 'open' ? 'green' : 'gray')}>
            {t.status === 'open' ? 'פתוח' : 'סגור'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.blue, cursor: 'pointer', marginBottom: 3 }}
              onClick={() => openThread(t.id)}>
              {t.subject}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{t.email || t.full_name || '—'} · {new Date(t.created_at).toLocaleDateString('he-IL')}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button style={btnBase('secondary', 'sm')} onClick={() => openThread(t.id)}>צפה</button>
            {t.status === 'open'
              ? <button style={btnBase('danger', 'sm')} onClick={async () => { await setStatus(t.id, 'close') }}>סגור</button>
              : <button style={btnBase('ghost', 'sm')} onClick={async () => { await setStatus(t.id, 'open') }}>פתח</button>
            }
          </div>
        </div>
      ))}
    </div>
  )
}

// ── BroadcastPanel ─────────────────────────────────────────────────
function BroadcastPanel() {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  async function send() {
    setLoading(true)
    setResult('')
    try {
      const res = await adminReq<{ sent: number }>('POST', '/broadcast', { subject, message })
      setResult(`✅ נשלח ל-${res.sent} משתמשים`)
      setSubject('')
      setMessage('')
    } catch (e) { setResult(e instanceof Error ? e.message : 'שגיאה') }
    setLoading(false)
  }

  return (
    <div style={{ ...card, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `1.5px solid ${C.border}` }}>
        <span style={{ fontSize: 22 }}>📢</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: C.fg }}>שידור לכל המשתמשים</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>נושא</label>
        <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="עדכון חשוב..." />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>הודעה</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="הקלד הודעה..." rows={5}
        />
      </div>
      {result && <p style={{ color: result.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: 12, fontWeight: 600 }}>{result}</p>}
      <button style={btnBase('primary')} onClick={send} disabled={loading || !subject || !message}>
        {loading ? 'שולח...' : '📤 שלח לכולם'}
      </button>
    </div>
  )
}
