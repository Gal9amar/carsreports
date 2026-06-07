import { useState, useEffect, useRef } from 'react'
import { api, VehicleData, MarketPrice } from '../api'

interface Props {
  plate: string
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

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 15
      }}>
        <span>{title}</span>
        <span style={{ color: '#9ca3af', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 18px 14px' }}>{children}</div>}
    </div>
  )
}

// ─── main ──────────────────────────────────────────────────
export default function ReportPage({ plate, onBack, onBuyMore }: Props) {
  const [data, setData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [market, setMarket] = useState<MarketPrice | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.lookupPlate(plate)
      .then(d => {
        setData(d)
        // Load note
        api.getNote(plate).then(n => setNote(n.note)).catch(() => {})
        // Load market price
        const r = d as Record<string, unknown>
        const mfr = String(r.tozeret_nm || '')
        const mdl = String(r.kinuy_mishari || r.degem_nm || '')
        const yr = String(r.shnat_yitzur || '')
        if (mfr || mdl) {
          setMarketLoading(true)
          api.getMarketPrice(mfr, mdl, yr)
            .then(setMarket)
            .catch(() => {})
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

  if (loading) return (
    <div className="page" style={{ paddingTop: 40 }}>
      <div className="spinner" />
      <p className="text-center text-muted mt-4" style={{ fontSize: 13 }}>טוען נתונים מכל המאגרים...</p>
    </div>
  )

  if (error) return (
    <div className="page">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>← חזרה</button>
      <div className="card text-center">
        <div style={{ fontSize: 48 }}>🔍</div>
        <p style={{ fontWeight: 600, marginTop: 8 }}>{error}</p>
        {error.includes('חיפושים') && <button className="btn btn-primary mt-4" onClick={onBuyMore}>רכוש חיפושים נוספים</button>}
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
  const overall = isRed ? { text: 'דורש בדיקה!', color: '#dc2626', bg: '#fee2e2' }
    : isYellow ? { text: 'שים לב', color: '#d97706', bg: '#fef9c3' }
    : { text: 'תקין', color: '#16a34a', bg: '#dcfce7' }

  const yad2Url = `https://www.yad2.co.il/vehicles/cars?manufacturer=${encodeURIComponent(val(r, 'tozeret_nm'))}&model=${encodeURIComponent(val(r, 'kinuy_mishari', 'degem_nm'))}&year=${val(r, 'shnat_yitzur')}`
  const fbUrl = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent([val(r, 'tozeret_nm'), val(r, 'kinuy_mishari', 'degem_nm'), val(r, 'shnat_yitzur')].join(' '))}`

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      {/* Back */}
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← חזרה
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <IsraeliPlate plate={plate} />
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 20 }}>
          {val(r, 'tozeret_nm')} {val(r, 'kinuy_mishari', 'degem_nm')}
        </div>
        <div style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>
          {val(r, 'shnat_yitzur')} · {val(r, 'tzeva_rechev')} · {val(r, 'sug_delek_nm')}
        </div>
        {scrapped && (
          <div style={{ background: '#dc2626', color: '#fff', borderRadius: 8, padding: '8px 16px', marginTop: 10, fontWeight: 700 }}>
            🚨 רכב גרוטאה — אינו רשאי לנסוע
          </div>
        )}
      </div>

      {/* Quick summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: overall.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${overall.color}22` }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>מצב כללי</div>
          <div style={{ fontWeight: 700, color: overall.color, fontSize: 16 }}>{overall.text}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>טסט</div>
          <div style={{ fontWeight: 700, color: tokef.color, fontSize: 13 }}>{tokef.emoji} {tokef.text}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>ק"מ בטסט</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{km ? `${parseInt(km).toLocaleString('he-IL')}` : '—'}</div>
          {km && <div style={{ fontSize: 11, color: '#9ca3af' }}>ק"מ</div>}
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>בעלויות</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{ownership.length}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>נוכחית: {ownershipLabel(r.baalut) || val(r, 'baalut')}</div>
        </div>
      </div>

      {/* Flags */}
      {(isInactive || personalImport || String(r.shinui_mivne_ind) === '1' || tagNache) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {isInactive && <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>⚠️ רישום לא פעיל</span>}
          {personalImport && <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>📦 יבוא אישי</span>}
          {String(r.shinui_mivne_ind) === '1' && <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>⚠️ שינוי מבנה</span>}
          {tagNache && <span style={{ background: '#f3e8ff', color: '#6b21a8', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>♿ תו נכה</span>}
        </div>
      )}

      {/* Market price */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af, #7c3aed)', borderRadius: 12, padding: 16, marginBottom: 10, color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>💰 מחיר שוק — Yad2</div>
        {marketLoading && <div style={{ opacity: 0.7, fontSize: 13 }}>טוען מחירי שוק...</div>}
        {!marketLoading && market?.prices && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'ממוצע שוק', value: market.prices.avg },
                { label: 'מינימום', value: market.prices.min },
                { label: 'מקסימום', value: market.prices.max },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>₪{fmtNum(value)}</div>
                </div>
              ))}
            </div>
            {market.total_on_road > 0 && (
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
                🚗 {fmtNum(market.total_on_road)} רכבים מסוג זה על הכביש בישראל
              </div>
            )}
          </>
        )}
        {!marketLoading && !market?.prices && (
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>לא נמצאו מחירי שוק</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={yad2Url} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, background: '#ff4444', color: '#fff', borderRadius: 8, padding: '10px 0',
            textAlign: 'center', fontWeight: 700, fontSize: 13, textDecoration: 'none'
          }}>חפש ב-Yad2</a>
          <a href={fbUrl} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, background: '#1877f2', color: '#fff', borderRadius: 8, padding: '10px 0',
            textAlign: 'center', fontWeight: 700, fontSize: 13, textDecoration: 'none'
          }}>Facebook Marketplace</a>
        </div>
      </div>

      {/* הערות אישיות */}
      <Section title="📝 הערות אישיות">
        <textarea
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="הוסף הערות אישיות לרכב זה... (מחיר סגירה, טלפון מוכר, מצב הרכב)"
          style={{
            width: '100%', minHeight: 80, border: '1.5px solid var(--border)', borderRadius: 8,
            padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', direction: 'rtl'
          }}
        />
        {noteSaved && <p style={{ color: '#16a34a', fontSize: 12, marginTop: 4 }}>✅ נשמר</p>}
      </Section>

      {/* פרטים כלליים */}
      <Section title="📋 פרטים כלליים">
        <Row label="יצרן" value={val(r, 'tozeret_nm')} />
        <Row label="דגם" value={val(r, 'kinuy_mishari', 'degem_nm')} />
        <Row label="רמת גימור" value={val(w, 'ramat_gimur')} />
        <Row label="שנת ייצור" value={val(r, 'shnat_yitzur')} />
        <Row label="צבע" value={val(r, 'tzeva_rechev')} />
        <Row label="בעלות נוכחית" value={ownershipLabel(r.baalut) || val(r, 'baalut')} />
        <Row label="ארץ ייצור" value={val(w, 'tozeret_eretz_nm')} />
        <Row label="יבואן/תוצר" value={val(w, 'tozar')} />
        <Row label="סוג מרכב" value={val(w, 'merkav')} />
        <Row label="סוג תקינה" value={val(w, 'sug_tkina_nm')} />
        <Row label="מסגרת (שלדה)" value={val(r, 'misgeret')} />
        <Row label="דגם מנוע" value={val(r, 'degem_manoa')} />
        <Row label="מספר מנוע" value={val(r, 'mispar_manoa')} />
        <Row label="מקוריות" value={val(r, 'mkoriut_nm')} />
        {val(w, 'kvuzat_agra_cd') && <Row label="קבוצת אגרה" value={val(w, 'kvuzat_agra_cd')} />}
        {importerPrice && <Row label="מחיר יבואן (חדש)" value={`₪${parseInt(String(importerPrice)).toLocaleString('he-IL')}`} bold />}
      </Section>

      {/* מפרט טכני */}
      <Section title="⚙️ מפרט טכני">
        <Row label="סוג דלק" value={val(r, 'sug_delek_nm')} />
        <Row label="טכנולוגיית הנעה" value={val(w, 'technologiat_hanaa_nm')} />
        <Row label="סוג הנעה" value={val(w, 'hanaa_nm')} />
        <Row label="נפח מנוע" value={val(w, 'nefah_manoa') ? `${val(w, 'nefah_manoa')} סמ"ק` : ''} />
        <Row label="כוח סוס" value={val(w, 'koah_sus')} />
        <Row label="תיבת הילוכים" value={w.automatic_ind === 1 || w.automatic_ind === '1' ? 'אוטומטית' : w.automatic_ind === 0 || w.automatic_ind === '0' ? 'ידנית' : ''} />
        <Row label="מושבים" value={val(w, 'mispar_moshavim')} />
        <Row label="דלתות" value={val(w, 'mispar_dlatot')} />
        <Row label="משקל כולל" value={val(w, 'mishkal_kolel') ? `${val(w, 'mishkal_kolel')} ק"ג` : ''} />
        <Row label="גרירה עם בלמים" value={val(w, 'kosher_grira_im_blamim') ? `${val(w, 'kosher_grira_im_blamim')} ק"ג` : ''} />
        <Row label="גרירה ללא בלמים" value={val(w, 'kosher_grira_bli_blamim') ? `${val(w, 'kosher_grira_bli_blamim')} ק"ג` : ''} />
      </Section>

      {/* גלגלים */}
      <Section title="🔧 גלגלים וצמיגים">
        <Row label="צמיג קדמי" value={val(r, 'zmig_kidmi')} />
        <Row label="צמיג אחורי" value={val(r, 'zmig_ahori')} />
        <Row label="עומס צמיג קדמי" value={val(r, 'kod_omes_tzmig_kidmi')} />
        <Row label="עומס צמיג אחורי" value={val(r, 'kod_omes_tzmig_ahori')} />
        <Row label="מהירות צמיג קדמי" value={val(r, 'kod_mehirut_tzmig_kidmi')} />
        <Row label="מהירות צמיג אחורי" value={val(r, 'kod_mehirut_tzmig_ahori')} />
        <Row label="וו גרירה" value={val(r, 'grira_nm')} />
      </Section>

      {/* ציוד */}
      <Section title="🛋️ ציוד ונוחות">
        <YnRow label="מיזוג אוויר" value={w.mazgan_ind} />
        <YnRow label="הגה כוח" value={w.hege_koah_ind} />
        <Row label="חלונות חשמל" value={val(w, 'mispar_halonot_hashmal') ? `${val(w, 'mispar_halonot_hashmal')} חלונות` : ''} />
        <YnRow label="גג פנורמי/שמש" value={w.halon_bagg_ind} />
        <YnRow label="חישוקי סגסוגת" value={w.galgaley_sagsoget_kala_ind} />
        <YnRow label="ארגז/תא מטען" value={w.argaz_ind} />
      </Section>

      {/* בטיחות */}
      <Section title="🛡️ בטיחות ופליטות">
        <Row label="ניקוד בטיחות" value={val(w, 'nikud_betihut')} />
        <Row label="כריות אוויר" value={val(w, 'mispar_kariot_avir') ? `${val(w, 'mispar_kariot_avir')} כריות` : ''} />
        <YnRow label="ABS" value={w.abs_ind} />
        <YnRow label="בקרת יציבות ESP" value={w.bakarat_yatzivut_ind} />
        <Row label="קבוצת זיהום" value={val(r, 'kvutzat_zihum', 'kvuzat_zihum')} />
        <Row label="מדד ירוק" value={val(w, 'madad_yarok')} />
        <Row label={`CO2 (WLTP) גר'/ק"מ`} value={val(w, 'CO2_WLTP')} />
        <Row label={`NOX מ"ג/ק"מ`} value={val(w, 'NOX_WLTP')} />
        <Row label="HC" value={val(w, 'HC_WLTP')} />
        <Row label="CO" value={val(w, 'CO_WLTP')} />
        <Row label="PM10" value={val(w, 'PM_WLTP')} />
      </Section>

      {/* ADAS */}
      <Section title="🤖 מערכות ADAS" defaultOpen={false}>
        <YnRow label="שמירת נתיב" value={w.bakarat_stiya_menativ_ind} />
        <YnRow label="בקרת סטייה אקטיבית" value={w.bakarat_stiya_activ_s} />
        <YnRow label="ניטור מרחק קדמי" value={w.nitur_merhak_milfanim_ind} />
        <YnRow label="זיהוי שטח עיוור" value={w.zihuy_beshetah_nistar_ind} />
        <YnRow label="בקרת שיוט אדפטיבית" value={w.bakarat_shyut_adaptivit_ind} />
        <YnRow label="בקרת מהירות ISA" value={w.bakarat_mehirut_isa} />
        <YnRow label="זיהוי הולכי רגל" value={w.zihuy_holchey_regel_ind} />
        <YnRow label="בלימת חירום אוטומטית" value={w.maarechet_ezer_labalam_ind} />
        <YnRow label="בלימה לפני הולכי רגל/אופניים" value={w.blimat_hirum_lifnei_holhei_regel_ofanaim} />
        <YnRow label="בלימה אוטומטית לאחור" value={w.blima_otomatit_nesia_leahor} />
        <YnRow label="מצלמת רוורס" value={w.matzlemat_reverse_ind} />
        <YnRow label="חיישני לחץ צמיגים" value={w.hayshaney_lahatz_avir_batzmigim_ind} />
        <YnRow label="חיישן עייפות נהג" value={w.hayshaney_hagorot_ind} />
        <YnRow label="זיהוי תמרורים" value={w.zihuy_tamrurey_tnua_ind} />
        <YnRow label="שליטה אוטו' בפנסי גבוה" value={w.shlita_automatit_beorot_gvohim_ind} />
        <YnRow label="התראת נסיעה קדימה" value={w.teura_automatit_benesiya_kadima_ind} />
        <YnRow label="זיהוי אופניים/קורקינט" value={w.zihuy_rechev_do_galgali} />
        <YnRow label="נעילת אלכוהול" value={w.alco_lock} />
      </Section>

      {/* היסטוריה */}
      <Section title="📅 היסטוריה ורישום">
        <Row label="תאריך רישום ראשון" value={fmtDate(r.rishum_rishon_dt)} />
        <Row label="עלייה לכביש" value={fmtMonthYear(r.moed_aliya_lakvish)} />
        <Row label={`ק"מ בטסט אחרון`} value={km ? `${parseInt(km).toLocaleString('he-IL')} ק"מ` : ''} />
        <Row label="טסט אחרון" value={fmtDate(r.mivchan_acharon_dt)} />
        <Row label="תוקף טסט" value={`${tokef.emoji} ${tokef.text}`} color={tokef.color} bold />
        <YnRow label="שינוי מבנה" value={r.shinui_mivne_ind} />
        <YnRow label="שינוי צבע" value={r.shnui_zeva_ind} />
        <YnRow label="שינוי צמיגים" value={r.shinui_zmig_ind} />
        <YnRow label="GAPAM" value={r.gapam_ind} />
        <Row label="תו נכה" value={tagNache ? '✅ כן' : '❌ לא'} />
        <Row label="סטטוס רישום" value={r._inactive_no_degem ? '⚠️ לא פעיל (ללא קוד דגם)' : r._inactive_registry ? '⚠️ לא פעיל' : '✅ פעיל'} />
      </Section>

      {/* בעלויות */}
      <Section title={`👥 היסטוריית בעלויות (${ownership.length})`}>
        {ownership.length === 0
          ? <p className="text-muted">לא נמצא מידע</p>
          : <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{ownership.length}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>סה"כ</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#1e40af' }}>{ownership.filter(o => o.baalut === 'פרטי').length}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>פרטיות</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 20, color: '#7c3aed' }}>{ownership.filter(o => o.baalut === 'סוחר').length}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>סוחר</div>
                </div>
              </div>
              {ownership.map((o, i) => {
                const dt = String(o.baalut_dt || '')
                const y = dt.slice(0, 4), m = dt.slice(4, 6)
                const months = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
                const dtStr = y && m ? `${months[parseInt(m, 10)] || m} ${y}` : dt
                const emoji = o.baalut === 'פרטי' ? '👤' : o.baalut === 'סוחר' ? '🏢' : '❓'
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < ownership.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{i + 1}. {emoji} {String(o.baalut || '')}</span>
                    <span style={{ color: '#6b7280' }}>{dtStr}</span>
                  </div>
                )
              })}
            </>
        }
      </Section>

      {/* ריקולים */}
      <Section title={`🔔 ריקולים (${recalls.length})`} defaultOpen={recalls.length > 0}>
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
                  <div key={i} style={{ padding: '12px 0', borderBottom: i < recalls.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
      </Section>

      <p className="text-center text-muted" style={{ fontSize: 11, marginBottom: 24 }}>
        המידע נאסף ממאגרים ממשלתיים וציבוריים. אין להסתמך על דוח זה כתחליף לבדיקה מקצועית.
      </p>
    </div>
  )
}
