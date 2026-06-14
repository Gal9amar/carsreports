import { useState, useRef } from 'react'
import { api, User } from '../api'

interface Props {
  user: User
  setUser: (u: User) => void
  onSearch: (plate: string) => void
  onLogout: () => void
  onBuyMore: () => void
}

/* ─── inline styles ─── */
const S = {
  statsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 28,
  },
  statCard: (topColor: string) => ({
    background: '#fff',
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    borderTop: `3px solid transparent`,
    borderImage: `${topColor} 1`,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  }),
  statCardInner: (topColor: string) => ({
    background: '#fff',
    borderRadius: 14,
    padding: '20px 22px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    borderTop: `3px solid`,
    borderTopColor: 'transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  }),
  iconCircle: (bg: string) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: bg,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: 20,
    marginBottom: 12,
  }),
  statValue: (color?: string) => ({
    fontSize: 32,
    fontWeight: 800,
    color: color || '#1e1b4b',
    lineHeight: 1,
    marginBottom: 4,
  }),
  statLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: 4,
  },
  statSub: {
    fontSize: 12,
    color: '#9ca3af',
  },
  /* search card */
  searchCard: {
    background: '#fff',
    borderRadius: 18,
    padding: '36px 40px',
    boxShadow: '0 4px 20px rgba(37,99,235,0.1)',
    border: '1.5px solid #e0e7ff',
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1e1b4b',
    marginBottom: 8,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  searchSub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 1.6,
  },
  plateInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    fontSize: 32,
    fontFamily: 'monospace',
    textAlign: 'center' as const,
    letterSpacing: 6,
    padding: '18px 20px',
    border: '2.5px solid #c7d2fe',
    borderRadius: 14,
    outline: 'none',
    color: '#1e1b4b',
    fontWeight: 700,
    background: '#f8faff',
    direction: 'ltr' as const,
    transition: 'border-color 0.2s',
  },
  searchBtn: (disabled: boolean) => ({
    width: '100%',
    marginTop: 16,
    padding: '16px 24px',
    borderRadius: 12,
    background: disabled
      ? '#e5e7eb'
      : 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
    border: 'none',
    color: disabled ? '#9ca3af' : '#fff',
    fontWeight: 800,
    fontSize: 18,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 6px 20px rgba(37,99,235,0.4)',
    transition: 'all 0.2s',
    letterSpacing: 0.5,
  }),
  errorBanner: {
    marginTop: 14,
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    color: '#dc2626',
    fontSize: 14,
    fontWeight: 600,
  },
  outOfSearches: {
    marginTop: 14,
    padding: '14px 18px',
    background: 'linear-gradient(90deg, #fef3c7, #fde68a)',
    border: '1px solid #fcd34d',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    color: '#92400e',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  buyBtn: {
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    padding: '6px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  codeSectionBorder: {
    marginTop: 24,
    borderTop: '1px solid #e0e7ff',
    paddingTop: 18,
  },
  codeLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'underline',
    padding: 0,
  },
  /* sidebar */
  sidebarCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    border: '1px solid #e0e7ff',
    marginBottom: 16,
  },
  sidebarTitle: {
    fontWeight: 800,
    fontSize: 15,
    color: '#1e1b4b',
    marginBottom: 14,
  },
  reportItem: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: '7px 0',
    fontSize: 13,
    color: '#4b5563',
    borderBottom: '1px solid #f3f4f6',
  },
  tipCard: {
    background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
    borderRadius: 16,
    padding: '22px 24px',
    color: '#fff',
  },
  tipTitle: {
    fontWeight: 800,
    fontSize: 15,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    opacity: 0.88,
    lineHeight: 1.6,
  },
  /* quota bar */
  quotaBarTrack: {
    height: 8,
    background: '#e0e7ff',
    borderRadius: 99,
    overflow: 'hidden' as const,
    marginTop: 10,
  },
  quotaBarFill: (pct: number) => ({
    height: '100%',
    width: `${pct}%`,
    background: pct > 70
      ? 'linear-gradient(90deg, #2563eb, #6366f1)'
      : pct > 30
        ? 'linear-gradient(90deg, #f59e0b, #f97316)'
        : 'linear-gradient(90deg, #ef4444, #dc2626)',
    borderRadius: 99,
    transition: 'width 0.4s ease',
  }),
}

export default function HomePage({ user, setUser, onSearch, onBuyMore }: Props) {
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeMsg, setCodeMsg] = useState('')
  const [showCodeField, setShowCodeField] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  async function handleSearch() {
    const cleaned = plate.replace(/[^a-zA-Z0-9א-ת]/g, '').toUpperCase()
    if (!cleaned) return
    setError('')
    setLoading(true)
    try {
      await api.lookupPlate(cleaned)
      onSearch(cleaned)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyCode() {
    if (!codeInput.trim()) return
    setCodeLoading(true)
    setCodeMsg('')
    try {
      const res = await api.applyCode(codeInput.trim())
      setCodeMsg(res.message)
      setCodeInput('')
      const updated = await api.getUser()
      setUser(updated)
    } catch (e) {
      setCodeMsg(e instanceof Error ? e.message : 'שגיאה')
    }
    setCodeLoading(false)
  }

  const quota = user.searches_quota
  const done = user.searches_done
  const left = user.searches_left
  const pct = quota === -1 ? 100 : Math.max(0, Math.round((left / quota) * 100))
  const isDisabled = loading || !plate.trim() || left === 0

  return (
    <>
      {/* ── Stats row ── */}
      <div style={S.statsGrid}>
        {/* Card 1: searches available */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          borderTop: '3px solid #2563eb',
        }}>
          <div style={S.iconCircle('#eff6ff')}>🔍</div>
          <div style={S.statLabel}>חיפושים זמינים</div>
          <div style={S.statValue('#2563eb')}>{quota === -1 ? '∞' : left}</div>
          <div style={S.statSub}>{quota === -1 ? 'ללא הגבלה' : `מתוך ${quota} בחבילה`}</div>
        </div>

        {/* Card 2: searches done */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          borderTop: '3px solid #6366f1',
        }}>
          <div style={S.iconCircle('#eef2ff')}>📊</div>
          <div style={S.statLabel}>חיפושים בוצעו</div>
          <div style={S.statValue('#6366f1')}>{done}</div>
          <div style={S.statSub}>סה"כ</div>
        </div>

        {/* Card 3: status */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          borderTop: user.is_subscriber ? '3px solid #16a34a' : '3px solid #3b82f6',
        }}>
          <div style={S.iconCircle(user.is_subscriber ? '#f0fdf4' : '#eff6ff')}>
            {user.is_subscriber ? '⭐' : '👤'}
          </div>
          <div style={S.statLabel}>סטטוס</div>
          <div style={{ marginBottom: 4, marginTop: 4 }}>
            {user.is_subscriber
              ? <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: '#dcfce7', color: '#16a34a', fontSize: 13, fontWeight: 700 }}>מנוי פעיל</span>
              : <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: '#dbeafe', color: '#2563eb', fontSize: 13, fontWeight: 700 }}>משתמש רגיל</span>
            }
          </div>
          <div style={S.statSub}>{user.is_admin ? '👑 מנהל' : 'משתמש'}</div>
        </div>

        {/* Card 4: usage bar */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          borderTop: '3px solid #8b5cf6',
        }}>
          <div style={S.iconCircle('#f5f3ff')}>📈</div>
          <div style={S.statLabel}>שימוש</div>
          <div style={S.quotaBarTrack}>
            <div style={S.quotaBarFill(pct)} />
          </div>
          <div style={{ ...S.statSub, marginTop: 8 }}>{pct}% נוצל</div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

        {/* ── Search card ── */}
        <div style={S.searchCard}>
          <div style={S.searchTitle}>
            <span>🚗</span>
            <span>בדוק רכב לפי לוחית רישוי</span>
          </div>
          <p style={S.searchSub}>
            הזן מספר רישוי ישראלי לקבלת דוח מלא ממאגרי משרד התחבורה
          </p>

          <input
            style={S.plateInput}
            type="text"
            placeholder="12-345-67"
            value={plate}
            onChange={e => setPlate(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            maxLength={10}
            autoFocus
            dir="ltr"
          />

          {error && <div style={S.errorBanner}>⚠️ {error}</div>}

          <button
            style={S.searchBtn(isDisabled)}
            onClick={handleSearch}
            disabled={isDisabled}
          >
            {loading ? '⌛ מחפש...' : '🔍 בדוק רכב'}
          </button>

          {left === 0 && (
            <div style={S.outOfSearches}>
              <span>⚠️ נגמרו החיפושים שלך</span>
              <button style={S.buyBtn} onClick={onBuyMore}>
                רכוש חבילה →
              </button>
            </div>
          )}

          {/* Access code */}
          <div style={S.codeSectionBorder}>
            {!showCodeField ? (
              <button
                style={S.codeLink}
                onClick={() => { setShowCodeField(true); setTimeout(() => codeRef.current?.focus(), 50) }}
              >
                יש לי קוד גישה
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#374151' }}>הזן קוד גישה</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    ref={codeRef}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      border: '1.5px solid #c7d2fe',
                      borderRadius: 8,
                      fontSize: 14,
                      textTransform: 'uppercase',
                      letterSpacing: 2,
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                    placeholder="XXXX-YYYY"
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                    dir="ltr"
                  />
                  <button
                    style={{
                      padding: '10px 18px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: codeLoading || !codeInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: codeLoading || !codeInput.trim() ? 0.6 : 1,
                      fontSize: 14,
                    }}
                    onClick={handleApplyCode}
                    disabled={codeLoading || !codeInput.trim()}
                  >
                    {codeLoading ? '...' : 'הפעל'}
                  </button>
                  <button
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      color: '#6b7280',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                    onClick={() => { setShowCodeField(false); setCodeMsg(''); setCodeInput('') }}
                  >
                    ✕
                  </button>
                </div>
                {codeMsg && (
                  <p style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    color: codeMsg.startsWith('✅') || codeMsg.startsWith('🎉') ? '#16a34a' : '#dc2626',
                  }}>
                    {codeMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Info sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={S.sidebarCard}>
            <div style={S.sidebarTitle}>מה כולל הדוח?</div>
            {[
              ['📋', 'פרטים כלליים ומפרט טכני'],
              ['🔧', 'גלגלים, ציוד ובטיחות'],
              ['🤖', 'מערכות ADAS מתקדמות'],
              ['📅', 'היסטוריית בעלויות'],
              ['🔔', 'ריקולים ושינויים'],
              ['💰', 'מחיר שוק ממוצע — Yad2'],
              ['📝', 'הערות אישיות'],
            ].map(([icon, text], i, arr) => (
              <div
                key={text}
                style={{
                  ...S.reportItem,
                  borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div style={S.tipCard}>
            <div style={S.tipTitle}>💡 טיפ</div>
            <div style={S.tipText}>
              הדוח שלנו מביא נתונים ממאגרים ממשלתיים בזמן אמת — תמיד מעודכן לרגע הבדיקה
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
