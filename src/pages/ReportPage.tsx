import { useState, useEffect } from 'react'
import { api, VehicleData } from '../api'

interface Props {
  plate: string
  onBack: () => void
  onBuyMore: () => void
}

const LABELS: Record<string, string> = {
  mispar_rechev: 'לוחית רישוי',
  kinuy_mishari: 'דגם',
  tozeret_nm: 'יצרן',
  degem_nm: 'שם דגם',
  shnat_yitzur: 'שנת יצור',
  tzeva_rechev: 'צבע',
  sug_delek_nm: 'סוג דלק',
  mivchan_acharon_dt: 'טסט אחרון',
  tokef_dt: 'תוקף רישיון',
  baalut: 'בעלות',
  sug_rechev: 'סוג רכב',
  mספר_kvutza: 'קבוצה',
}

export default function ReportPage({ plate, onBack, onBuyMore }: Props) {
  const [data, setData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.lookupPlate(plate)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [plate])

  return (
    <div className="page">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
        ← חזרה
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          background: 'var(--blue)', color: '#fff', borderRadius: 8,
          padding: '8px 16px', fontSize: 22, fontWeight: 800, letterSpacing: 4
        }}>
          {plate}
        </div>
        <h1 className="page-title" style={{ margin: 0 }}>דו"ח רכב</h1>
      </div>

      {loading && <div className="spinner" />}

      {error && (
        <div className="card text-center">
          <div style={{ fontSize: 48 }}>🔍</div>
          <p style={{ fontWeight: 600, marginTop: 8 }}>{error}</p>
          {error.includes('חיפושים') && (
            <button className="btn btn-primary mt-4" onClick={onBuyMore}>רכוש חיפושים נוספים</button>
          )}
        </div>
      )}

      {data && !loading && (
        <div className="card">
          {Object.entries(data)
            .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_'))
            .map(([k, v]) => (
              <div className="report-row" key={k}>
                <span className="report-label">{LABELS[k] || k}</span>
                <span className="report-value">{String(v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
