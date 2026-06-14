import { useState, useEffect, useRef } from 'react'
import { api, User, VehicleData, MarketPrice } from '../api'
import { generateReportPdf } from '../utils/generatePdf'

interface Props {
  plate: string
  user: User
  onBack: () => void
  onBuyMore: () => void
}

// ─── helpers ───────────────────────────────────────────────
function val(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k]
    if (v != null && !['', 'None', 'nan', '0'].includes(String(v).trim())) return String(v).trim()
  }
  return ''
}

function fmtDate(raw: unknown): string {
  if (!raw) return ''
  try { return new Date(String(raw).slice(0, 10)).toLocaleDateString('he-IL') } catch { return String(raw).slice(0, 10) }
}

function fmtMonthYear(raw: unknown): string {
  const s = String(raw || '')
  const [y, m] = s.split('-')
  return (y && m) ? `${m}/${y}` : s
}

function fmtNum(n: number): string {
  return n.toLocaleString('he-IL')
}

function testStatus(tokef: unknown): { text: string; color: string; emoji: string } {
  if (!tokef) return { text: 'לא ידוע', color: '#6b7280', emoji: '❓' }
  try {
    const d = new Date(String(tokef).slice(0, 10))
    const delta = Math.floor((d.getTime() - Date.now()) / 86400000)
    if (delta < 0) return { text: `פג תוקף לפני ${Math.abs(delta)} ימים`, color: '#dc2626', emoji: '🔴' }
    if (delta <= 30) return { text: `פג תוקף בעוד ${delta} ימים`, color: '#d97706', emoji: '🟡' }
    return { text: `בתוקף עד ${d.toLocaleDateString('he-IL')}`, color: '#16a34a', emoji: '🟢' }
  } catch { return { text: 'לא ידוע', color: '#6b7280', emoji: '❓' } }
}

function yn(v: unknown): { text: string; yes: boolean | null } {
  if (v == null || String(v).trim() === '' || String(v) === 'None') return { text: 'לא קיים', yes: null }
  const s = String(v).trim().toUpperCase()
  if (['1', 'Y', 'YES', 'TRUE'].includes(s)) return { text: 'כן', yes: true }
  if (['0', 'N', 'NO', 'FALSE'].includes(s)) return { text: 'לא', yes: false }
  return { text: s, yes: null }
}

function ownershipLabel(baalut: unknown): string {
  const map: Record<string, string> = { '1': 'ראשונה', '2': 'שנייה', '3': 'שלישית', '4': 'רביעית', '5': 'חמישית ומעלה' }
  return map[String(baalut || '').trim()] || String(baalut || '')
}

// ─── components ────────────────────────────────────────────
function IsraeliPlate({ plate }: { plate: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 8,
      border: '2px solid #1a56a0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        background: '#003399', color: '#fff', padding: '6px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 9, fontWeight: 700, gap: 1
      }}>
        <span>🇮🇱</span>
        <span>IL</span>
      </div>
      <div style={{
        background: '#fff8c0', padding: '6px 16px',
        fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#111', fontFamily: 'monospace'
      }}>
        {plate}
      </div>
    </div>
  )
}

// Field component: label (small muted uppercase) + value (bold)
function Field({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || '#1e1b4b', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value || <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}
      </span>
    </div>
  )
}

function YnField({ label, value }: { label: string; value: unknown }) {
  const { text, yes } = yn(value)
  const color = yes === true ? '#16a34a' : yes === false ? '#dc2626' : '#9ca3af'
  const icon = yes === true ? '✅' : yes === false ? '❌' : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{icon} {text}</span>
    </div>
  )
}

// Legacy Row for backwards-compatible usage in ownership/recall sections
function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  if (!value) return (
    <div className="report-row">
      <span className="report-label">{label}</span>
      <span style={{ fontSize: 13, color: '#d1d5db' }}>—</span>
    </div>
  )
  return (
    <div className="report-row">
      <span className="report-label">{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}

function YnRow({ label, value }: { label: string; value: unknown }) {
  const { text, yes } = yn(value)
  return (
    <div className="report-row">
      <span className="report-label">{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: yes === true ? '#16a34a' : yes === false ? '#dc2626' : '#9ca3af' }}>
        {yes === true ? '✅' : yes === false ? '❌' : '—'} {text}
      </span>
    </div>
  )
}

// Card section with gradient accent bar
function Section({ title, children, defaultOpen = true, accent = '#2563eb' }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  accent?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 2px 12px rgba(37,99,235,0.07)',
      marginBottom: 12,
      overflow: 'hidden',
      border: '1px solid #e0e7ff',
    }}>
      {/* Gradient top accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${accent}, #6366f1)`,
      }} />
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 20px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontWeight: 800, fontSize: 15, color: '#1e1b4b',
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 700 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 20px 18px' }}>{children}</div>}
    </div>
  )
}

// 2-col field grid inside sections
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '14px 24px',
      paddingTop: 4,
    }}>
      {children}
    </div>
  )
}

// Skeleton loading
function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e0e7ff',
      boxShadow: '0 2px 12px rgba(37,99,235,0.07)', marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{ height: 3, background: '#e0e7ff' }} />
      <div style={{ padding: '14px 20px 18px' }}>
        <div className="skeleton skeleton-title" style={{ width: '40%', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 24px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton skeleton-text" style={{ width: '80%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────
export default function ReportPage({ plate, user, onBack, onBuyMore }: Props) {
  const [data, setData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [market, setMarket] = useState<MarketPrice | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [watched, setWatched] = useState(false)
  const [watchLoading, setWatchLoading] = useState(false)

  useEffect(() => {
    api.getWatches().then(ws => {
      setWatched(ws.some(w => w.plate === plate))
    }).catch(() => {})
  }, [plate])

  async function toggleWatch() {
    setWatchLoading(true)
    try {
      if (watched) {
        await api.removeWatch(plate)
        setWatched(false)
      } else {
        await api.addWatch(plate)
        setWatched(true)
      }
    } catch {
      // ignore
    } finally {
      setWatchLoading(false)
    }
  }

  useEffect(() => {
    api.lookupPlate(plate)
      .then(d => {
        setData(d)
        api.getNote(plate).then(n => setNote(n.note)).catch(() => {})
        const r = d as Record<string, unknown>
        const mfr = String(r.tozeret_nm || '')
        const mdl = String(r.kinuy_mishari || r.degem_nm || '')
        const yr = String(r.shnat_yitzur || '')
        console.log('[ReportPage] market price params:', { mfr, mdl, yr })
        if (mfr || mdl) {
          setMarketLoading(true)
          api.getMarketPrice(mfr, mdl, yr)
            .then(result => {
              console.log('[ReportPage] market price response:', JSON.stringify(result))
              setMarket(result)
            })
            .catch(e => console.error('[ReportPage] market price error:', e))
            .finally(() => setMarketLoading(false))
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [plate])

  function handleNoteChange(v: string) {
    setNote(v)
    setNoteSaved(false)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      api.saveNote(plate, v).then(() => setNoteSaved(true)).catch(() => {})
    }, 1000)
  }

  // ── Loading state ──
  if (loading) return (
    <div style={{ paddingTop: 20 }}>
      {/* Header skeleton */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 120, height: 44, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 160, height: 28, borderRadius: 6 }} />
        </div>
      </div>
      <div className="report-layout">
        <div>
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div>
          <div style={{
            background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
            borderRadius: 14, padding: 18, marginBottom: 12,
          }}>
            <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 14, borderRadius: 6, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 6px' }}>
                  <div className="skeleton" style={{ height: 10, width: '70%', margin: '0 auto 6px', borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
                  <div className="skeleton" style={{ height: 16, width: '80%', margin: '0 auto', borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e7ff', padding: 18 }}>
            <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 12, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 100, borderRadius: 8 }} />
          </div>
        </div>
      </div>
      <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 16 }}>
        טוען נתונים מכל המאגרים...
      </p>
    </div>
  )

  // ── Error state ──
  if (error) return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
          fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >← חזרה</button>
      <div className="card text-center">
        <div style={{ fontSize: 48 }}>🔍</div>
        <p style={{ fontWeight: 600, marginTop: 8 }}>{error}</p>
        {error.includes('חיפושים') && (
          <button className="btn btn-primary mt-4" onClick={onBuyMore}>רכוש חיפושים נוספים</button>
        )}
      </div>
    </div>
  )

  if (!data) return null

  const r = data as Record<string, unknown>
  const w = (r._wltp as Record<string, unknown>) || {}
  const ownership = (r._ownership as Record<string, unknown>[]) || []
  const recalls = (r._recalls as Record<string, unknown>[]) || []
  const recallsByPlate = r._recalls_by_plate as boolean
  const tagNache = r._tag_nache as Record<string, unknown> | undefined
  const scrapped = r._scrapped_dt as string
  const isInactive = r._inactive_registry || r._inactive_no_degem
  const personalImport = r._personal_import as Record<string, unknown> | undefined
  const importerPrice = r._importer_price
  const tokef = testStatus(r.tokef_dt)
  const km = val(r, 'kilometer_test_aharon')

  const isRed = !!scrapped || tokef.emoji === '🔴'
  const isYellow = !isRed && (!!isInactive || tokef.emoji === '🟡' || String(r.shinui_mivne_ind) === '1')
  const overall = isRed
    ? { text: 'דורש בדיקה!', color: '#dc2626', bg: '#fee2e2' }
    : isYellow
    ? { text: 'שים לב', color: '#d97706', bg: '#fef9c3' }
    : { text: 'תקין', color: '#16a34a', bg: '#dcfce7' }

  const yad2Url = `https://www.yad2.co.il/vehicles/cars?manufacturer=${encodeURIComponent(val(r, 'tozeret_nm'))}&model=${encodeURIComponent(val(r, 'kinuy_mishari', 'degem_nm'))}&year=${val(r, 'shnat_yitzur')}`
  const fbUrl = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent([val(r, 'tozeret_nm'), val(r, 'kinuy_mishari', 'degem_nm'), val(r, 'shnat_yitzur')].join(' '))}`

  const vehicleName = [val(r, 'tozeret_nm'), val(r, 'kinuy_mishari', 'degem_nm')].filter(Boolean).join(' ')

  return (
    <div>
      {/* ── Header Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        {/* Left: breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f0f4ff', border: '1.5px solid #c7d2fe',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 13, fontWeight: 700, color: '#1e40af',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >← חזרה</button>
          <IsraeliPlate plate={plate} />
          {vehicleName && (
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b' }}>{vehicleName}</span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {user.show_watches ? (
            <button
              onClick={toggleWatch}
              disabled={watchLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: watched ? 'none' : '1.5px solid #c7d2fe',
                background: watched ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#f0f4ff',
                color: watched ? '#fff' : '#6366f1',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              } as React.CSSProperties}
            >
              {watched ? '⭐ שמור' : '☆ שמור רכב'}
            </button>
          ) : (
            <button
              disabled
              title="זמין למנויים בלבד"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: '1.5px solid #e5e7eb',
                background: '#f9fafb',
                color: '#9ca3af',
                fontSize: 13, fontWeight: 700,
                cursor: 'not-allowed',
              }}
            >🔒 שמור רכב — למנויים בלבד</button>
          )}

          {user.show_pdf_report ? (
            <button
              onClick={() => generateReportPdf(plate, r, market?.prices ?? null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
            >📄 PDF</button>
          ) : (
            <button
              disabled
              title="הורדת PDF זמינה למנויים בלבד"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: '#f3f4f6',
                color: '#9ca3af', border: '1.5px solid #e5e7eb',
                fontSize: 13, fontWeight: 700,
                cursor: 'not-allowed',
              }}
            >🔒 הורד דוח PDF — למנויים בלבד</button>
          )}

          {/* Searches left badge */}
          <span style={{
            background: '#dbeafe', color: '#1e40af',
            borderRadius: 99, padding: '6px 14px',
            fontSize: 12, fontWeight: 700,
          }}>
            {val(r, 'searches_left') || ''}
          </span>
        </div>
      </div>

      {/* Vehicle subtitle */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {val(r, 'shnat_yitzur') && <span>{val(r, 'shnat_yitzur')}</span>}
          {val(r, 'tzeva_rechev') && <><span>·</span><span>{val(r, 'tzeva_rechev')}</span></>}
          {val(r, 'sug_delek_nm') && <><span>·</span><span>{val(r, 'sug_delek_nm')}</span></>}
        </div>
        {scrapped && (
          <div style={{
            display: 'inline-block', background: '#dc2626', color: '#fff',
            borderRadius: 8, padding: '6px 14px', marginTop: 8,
            fontWeight: 700, fontSize: 14,
          }}>🚨 רכב גרוטאה — אינו רשאי לנסוע</div>
        )}
      </div>

      {/* Flags */}
      {(isInactive || personalImport || String(r.shinui_mivne_ind) === '1' || tagNache) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {!!isInactive && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>⚠️ רישום לא פעיל</span>}
          {!!personalImport && <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>📦 יבוא אישי</span>}
          {String(r.shinui_mivne_ind) === '1' && <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>⚠️ שינוי מבנה</span>}
          {tagNache && <span style={{ background: '#f3e8ff', color: '#6b21a8', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>♿ תו נכה</span>}
        </div>
      )}

      {/* Quick summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        <div style={{ background: overall.bg, borderRadius: 12, padding: '12px 16px', border: `1.5px solid ${overall.color}33` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>מצב כללי</div>
          <div style={{ fontWeight: 800, color: overall.color, fontSize: 16 }}>{overall.text}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e0e7ff', boxShadow: '0 1px 6px rgba(37,99,235,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>טסט</div>
          <div style={{ fontWeight: 700, color: tokef.color, fontSize: 13 }}>{tokef.emoji} {tokef.text}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e0e7ff', boxShadow: '0 1px 6px rgba(37,99,235,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>ק"מ בטסט</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{km ? parseInt(km).toLocaleString('he-IL') : '—'}</div>
          {km && <div style={{ fontSize: 10, color: '#9ca3af' }}>ק"מ</div>}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e0e7ff', boxShadow: '0 1px 6px rgba(37,99,235,0.06)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>בעלויות</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{ownership.length}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>נוכחית: {ownershipLabel(r.baalut) || val(r, 'baalut')}</div>
        </div>
      </div>

      {/* 2-column report layout */}
      <div className="report-layout">
        {/* ── LEFT MAIN ── */}
        <div className="report-main">

          {/* 🚗 פרטי רכב */}
          <Section title="🚗 פרטי רכב" accent="#2563eb">
            <FieldGrid>
              <Field label="יצרן" value={val(r, 'tozeret_nm')} />
              <Field label="דגם" value={val(r, 'kinuy_mishari', 'degem_nm')} />
              <Field label="רמת גימור" value={val(w, 'ramat_gimur')} />
              <Field label="שנת ייצור" value={val(r, 'shnat_yitzur')} />
              <Field label="צבע" value={val(r, 'tzeva_rechev')} />
              <Field label="בעלות נוכחית" value={ownershipLabel(r.baalut) || val(r, 'baalut')} />
              <Field label="ארץ ייצור" value={val(w, 'tozeret_eretz_nm')} />
              <Field label="יבואן/תוצר" value={val(w, 'tozar')} />
              <Field label="סוג מרכב" value={val(w, 'merkav')} />
              <Field label="סוג תקינה" value={val(w, 'sug_tkina_nm')} />
              <Field label="מסגרת (שלדה)" value={val(r, 'misgeret')} />
              <Field label="דגם מנוע" value={val(r, 'degem_manoa')} />
              <Field label="מספר מנוע" value={val(r, 'mispar_manoa')} />
              <Field label="מקוריות" value={val(r, 'mkoriut_nm')} />
              {val(w, 'kvuzat_agra_cd') ? <Field label="קבוצת אגרה" value={val(w, 'kvuzat_agra_cd')} /> : null}
              {importerPrice
                ? <Field label="מחיר יבואן (חדש)" value={`₪${parseInt(String(importerPrice)).toLocaleString('he-IL')}`} color="#1e40af" />
                : null}
            </FieldGrid>
          </Section>

          {/* 🔧 מפרט טכני */}
          <Section title="🔧 מפרט טכני" accent="#7c3aed">
            <FieldGrid>
              <Field label="סוג דלק" value={val(r, 'sug_delek_nm')} />
              <Field label="טכנולוגיית הנעה" value={val(w, 'technologiat_hanaa_nm')} />
              <Field label="סוג הנעה" value={val(w, 'hanaa_nm')} />
              <Field label="נפח מנוע" value={val(w, 'nefah_manoa') ? `${val(w, 'nefah_manoa')} סמ"ק` : ''} />
              <Field label="כוח סוס" value={val(w, 'koah_sus')} />
              <Field label="תיבת הילוכים" value={
                w.automatic_ind === 1 || w.automatic_ind === '1'
                  ? 'אוטומטית'
                  : w.automatic_ind === 0 || w.automatic_ind === '0'
                  ? 'ידנית'
                  : ''
              } />
              <Field label="מושבים" value={val(w, 'mispar_moshavim')} />
              <Field label="דלתות" value={val(w, 'mispar_dlatot')} />
              <Field label="משקל כולל" value={val(w, 'mishkal_kolel') ? `${val(w, 'mishkal_kolel')} ק"ג` : ''} />
              <Field label="גרירה עם בלמים" value={val(w, 'kosher_grira_im_blamim') ? `${val(w, 'kosher_grira_im_blamim')} ק"ג` : ''} />
              <Field label="גרירה ללא בלמים" value={val(w, 'kosher_grira_bli_blamim') ? `${val(w, 'kosher_grira_bli_blamim')} ק"ג` : ''} />
            </FieldGrid>
          </Section>

          {/* ⚙️ גלגלים וציוד */}
          <Section title="⚙️ גלגלים וציוד" accent="#0891b2">
            <FieldGrid>
              <Field label="צמיג קדמי" value={val(r, 'zmig_kidmi')} mono />
              <Field label="צמיג אחורי" value={val(r, 'zmig_ahori')} mono />
              <Field label="עומס צמיג קדמי" value={val(r, 'kod_omes_tzmig_kidmi')} />
              <Field label="עומס צמיג אחורי" value={val(r, 'kod_omes_tzmig_ahori')} />
              <Field label="מהירות צמיג קדמי" value={val(r, 'kod_mehirut_tzmig_kidmi')} />
              <Field label="מהירות צמיג אחורי" value={val(r, 'kod_mehirut_tzmig_ahori')} />
              <Field label="וו גרירה" value={val(r, 'grira_nm')} />
            </FieldGrid>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>ציוד ונוחות</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
                <YnField label="מיזוג אוויר" value={w.mazgan_ind} />
                <YnField label="הגה כוח" value={w.hege_koah_ind} />
                <Field label="חלונות חשמל" value={val(w, 'mispar_halonot_hashmal') ? `${val(w, 'mispar_halonot_hashmal')} חלונות` : ''} />
                <YnField label="גג פנורמי/שמש" value={w.halon_bagg_ind} />
                <YnField label="חישוקי סגסוגת" value={w.galgaley_sagsoget_kala_ind} />
                <YnField label="ארגז/תא מטען" value={w.argaz_ind} />
              </div>
            </div>
          </Section>

          {/* 🤖 מערכות בטיחות ADAS */}
          <Section title="🤖 מערכות בטיחות ADAS" accent="#059669" defaultOpen={false}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
              <YnField label="שמירת נתיב" value={w.bakarat_stiya_menativ_ind} />
              <YnField label="בקרת סטייה אקטיבית" value={w.bakarat_stiya_activ_s} />
              <YnField label="ניטור מרחק קדמי" value={w.nitur_merhak_milfanim_ind} />
              <YnField label="זיהוי שטח עיוור" value={w.zihuy_beshetah_nistar_ind} />
              <YnField label="בקרת שיוט אדפטיבית" value={w.bakarat_shyut_adaptivit_ind} />
              <YnField label="בקרת מהירות ISA" value={w.bakarat_mehirut_isa} />
              <YnField label="זיהוי הולכי רגל" value={w.zihuy_holchey_regel_ind} />
              <YnField label="בלימת חירום אוטומטית" value={w.maarechet_ezer_labalam_ind} />
              <YnField label="בלימה לפני הולכי רגל" value={w.blimat_hirum_lifnei_holhei_regel_ofanaim} />
              <YnField label="בלימה אוטומטית לאחור" value={w.blima_otomatit_nesia_leahor} />
              <YnField label="מצלמת רוורס" value={w.matzlemat_reverse_ind} />
              <YnField label="חיישני לחץ צמיגים" value={w.hayshaney_lahatz_avir_batzmigim_ind} />
              <YnField label="חיישן עייפות נהג" value={w.hayshaney_hagorot_ind} />
              <YnField label="זיהוי תמרורים" value={w.zihuy_tamrurey_tnua_ind} />
              <YnField label="שליטה אוטו' בפנסי גבוה" value={w.shlita_automatit_beorot_gvohim_ind} />
              <YnField label="התראת נסיעה קדימה" value={w.teura_automatit_benesiya_kadima_ind} />
              <YnField label="זיהוי אופניים/קורקינט" value={w.zihuy_rechev_do_galgali} />
              <YnField label="נעילת אלכוהול" value={w.alco_lock} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>בטיחות ופליטות</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
                <Field label="ניקוד בטיחות" value={val(w, 'nikud_betihut')} />
                <Field label="כריות אוויר" value={val(w, 'mispar_kariot_avir') ? `${val(w, 'mispar_kariot_avir')} כריות` : ''} />
                <YnField label="ABS" value={w.abs_ind} />
                <YnField label="בקרת יציבות ESP" value={w.bakarat_yatzivut_ind} />
                <Field label="קבוצת זיהום" value={val(r, 'kvutzat_zihum', 'kvuzat_zihum')} />
                <Field label="מדד ירוק" value={val(w, 'madad_yarok')} />
                <Field label={`CO2 (WLTP) גר'/ק"מ`} value={val(w, 'CO2_WLTP')} />
                <Field label={`NOX מ"ג/ק"מ`} value={val(w, 'NOX_WLTP')} />
              </div>
            </div>
          </Section>

          {/* 👤 היסטוריית בעלויות */}
          <Section title={`👤 היסטוריית בעלויות (${ownership.length})`} accent="#1e40af">
            {ownership.length === 0
              ? <p className="text-muted">לא נמצא מידע</p>
              : <>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 22, color: '#1e1b4b' }}>{ownership.length}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>סה"כ</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 22, color: '#1e40af' }}>{ownership.filter(o => o.baalut === 'פרטי').length}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>פרטיות</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 22, color: '#7c3aed' }}>{ownership.filter(o => o.baalut === 'סוחר').length}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>סוחר</div>
                    </div>
                  </div>
                  {ownership.map((o, i) => {
                    const dt = String(o.baalut_dt || '')
                    const y = dt.slice(0, 4), m = dt.slice(4, 6)
                    const months = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                    const dtStr = y && m ? `${months[parseInt(m, 10)] || m} ${y}` : dt
                    const emoji = o.baalut === 'פרטי' ? '👤' : o.baalut === 'סוחר' ? '🏢' : '❓'
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '10px 0', fontSize: 14,
                        borderBottom: i < ownership.length - 1 ? '1px solid #e0e7ff' : 'none',
                      }}>
                        <span style={{ fontWeight: 700 }}>{i + 1}. {emoji} {String(o.baalut || '')}</span>
                        <span style={{ color: '#6b7280' }}>{dtStr}</span>
                      </div>
                    )
                  })}
                </>
            }
          </Section>

          {/* 🔔 ריקולים ושינויים */}
          <Section title={`🔔 ריקולים ושינויים (${recalls.length})`} accent="#dc2626" defaultOpen={recalls.length > 0}>
            {/* History fields */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>היסטוריה ורישום</div>
              <FieldGrid>
                <Field label="תאריך רישום ראשון" value={fmtDate(r.rishum_rishon_dt)} />
                <Field label="עלייה לכביש" value={fmtMonthYear(r.moed_aliya_lakvish)} />
                <Field label={`ק"מ בטסט אחרון`} value={km ? `${parseInt(km).toLocaleString('he-IL')} ק"מ` : ''} />
                <Field label="טסט אחרון" value={fmtDate(r.mivchan_acharon_dt)} />
                <Field label="תוקף טסט" value={`${tokef.emoji} ${tokef.text}`} color={tokef.color} />
                <Field label="סטטוס רישום" value={
                  r._inactive_no_degem ? '⚠️ לא פעיל (ללא קוד דגם)'
                  : r._inactive_registry ? '⚠️ לא פעיל'
                  : '✅ פעיל'
                } />
              </FieldGrid>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px', marginTop: 14 }}>
                <YnField label="שינוי מבנה" value={r.shinui_mivne_ind} />
                <YnField label="שינוי צבע" value={r.shnui_zeva_ind} />
                <YnField label="שינוי צמיגים" value={r.shinui_zmig_ind} />
                <YnField label="GAPAM" value={r.gapam_ind} />
                <Field label="תו נכה" value={tagNache ? '✅ כן' : '❌ לא'} />
              </div>
            </div>

            {/* Recalls */}
            <div style={{ borderTop: '1px solid #e0e7ff', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>ריקולים</div>
              {recalls.length === 0
                ? <p className="text-muted">לא נמצאו ריקולים {recallsByPlate ? 'לרכב זה' : 'לדגם זה'}</p>
                : <>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                      {recallsByPlate ? '✅ ספציפי ללוחית זו' : '⚠️ לפי דגם — לא ספציפי ללוחית'}
                    </p>
                    {recalls.map((rc, i) => {
                      const teur = String(rc.TEUR_TAKALA || rc.teur_takala || '')
                      const date = String(rc.TAARICH_PTICHA || rc.SHNAT_RECALL || '').slice(0, 10)
                      const kat = String(rc.SUG_TAKALA || '')
                      const ofen = String(rc.OFEN_TIKUN || '')
                      const phone = String(rc.TELEPHONE || '')
                      return (
                        <div key={i} style={{ padding: '12px 0', borderBottom: i < recalls.length - 1 ? '1px solid #e0e7ff' : 'none' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1e40af' }}>
                            {date} {kat && `· ${kat}`}
                          </div>
                          <div style={{ fontSize: 13, color: '#374151', marginBottom: ofen || phone ? 6 : 0 }}>{teur}</div>
                          {ofen && <div style={{ fontSize: 12, color: '#6b7280' }}>תיקון: {ofen}</div>}
                          {phone && <div style={{ fontSize: 12, color: '#6b7280' }}>📞 {phone}</div>}
                        </div>
                      )
                    })}
                  </>
              }
            </div>
          </Section>

          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11, marginBottom: 24 }}>
            המידע נאסף ממאגרים ממשלתיים וציבוריים. אין להסתמך על דוח זה כתחליף לבדיקה מקצועית.
          </p>
        </div>{/* end report-main */}

        {/* ── RIGHT SIDEBAR ── */}
        <div className="report-sidebar">
          {/* Degem total card */}
          {!!(data as Record<string, unknown>)?._degem_total && (() => {
            const r = data as Record<string, unknown>
            const yearTotal = Number(r._degem_total)
            const yr = String(r.shnat_yitzur || '')
            return (
              <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                borderRadius: 16, padding: '18px 20px', marginBottom: 14, color: '#fff',
                boxShadow: '0 4px 16px rgba(15,23,42,0.3)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4 }}>רכבים משנת {yr} על כבישי ישראל</div>
                <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
                  {fmtNum(yearTotal)}
                </div>
              </div>
            )
          })()}

          {/* Market price card */}
          <div style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #6d28d9 100%)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 14,
            color: '#fff',
            boxShadow: '0 8px 32px rgba(30,64,175,0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>💰 מחיר שוק — Yad2</div>

            {marketLoading && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 6px' }}>
                      <div className="skeleton" style={{ height: 10, width: '70%', margin: '0 auto 6px', borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
                      <div className="skeleton" style={{ height: 18, width: '80%', margin: '0 auto', borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {!marketLoading && market?.prices && (
              <>
                {/* Big price number */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>ממוצע שוק</div>
                  <div style={{
                    fontSize: 32, fontWeight: 900, letterSpacing: -1,
                    ...(user.show_market_price ? {} : { filter: 'blur(6px)', userSelect: 'none' }),
                  }}>
                    ₪{fmtNum(market.prices.avg)}
                  </div>
                  {market.total_on_road > 0 && (
                    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 5 }}>
                      ממוצע מתוך {fmtNum(market.total_on_road)} מודעות פעילות באתר
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {[
                    { label: 'מינימום', value: `₪${fmtNum(market.prices.min)}` },
                    { label: 'מקסימום', value: `₪${fmtNum(market.prices.max)}` },
                    { label: 'ק״מ ממוצע', value: market.prices.avg_km ? `${fmtNum(market.prices.avg_km)}` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 3 }}>{label}</div>
                      <div style={{
                        fontWeight: 800, fontSize: 13,
                        ...(user.show_market_price ? {} : { filter: 'blur(6px)', userSelect: 'none' }),
                      }}>{value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!marketLoading && !market?.prices && (
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 14, textAlign: 'center', padding: '8px 0' }}>
                לא נמצאו מחירי שוק
              </div>
            )}

            {/* Lock overlay for market price */}
            {!user.show_market_price && market?.prices && !marketLoading && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.55)',
                borderRadius: 16,
                zIndex: 2,
                gap: 6,
              }}>
                <span style={{ fontSize: 28 }}>🔒</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#fff', textAlign: 'center', padding: '0 16px' }}>
                  מחיר שוק — זמין למנויים בלבד
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <a href={yad2Url} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, background: '#ff4444', color: '#fff', borderRadius: 10, padding: '10px 0',
                textAlign: 'center', fontWeight: 800, fontSize: 13, textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(255,68,68,0.4)',
              }}>חפש ב-Yad2</a>
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, background: '#1877f2', color: '#fff', borderRadius: 10, padding: '10px 0',
                textAlign: 'center', fontWeight: 800, fontSize: 13, textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(24,119,242,0.4)',
              }}>Marketplace</a>
            </div>
          </div>

          {/* Notes card */}
          <div style={{
            background: '#fff', borderRadius: 16, border: '1.5px solid #e0e7ff',
            boxShadow: '0 4px 16px rgba(37,99,235,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              height: 3,
              background: 'linear-gradient(90deg, #6366f1, #2563eb)',
            }} />
            <div style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: '#1e1b4b' }}>📝 הערות אישיות</div>
              <textarea
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder="מחיר סגירה, טלפון מוכר, מצב הרכב..."
                style={{
                  width: '100%', minHeight: 110,
                  border: '1.5px solid #c7d2fe', borderRadius: 10,
                  padding: 12, fontSize: 14, fontFamily: 'inherit',
                  resize: 'vertical', direction: 'rtl',
                  outline: 'none', color: '#1e1b4b',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#c7d2fe' }}
              />
              {noteSaved && (
                <p style={{ color: '#16a34a', fontSize: 12, marginTop: 6, fontWeight: 600 }}>✅ נשמר</p>
              )}
            </div>
          </div>
        </div>
      </div>{/* end report-layout */}
    </div>
  )
}
