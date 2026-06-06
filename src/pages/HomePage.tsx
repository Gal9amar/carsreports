import { useState } from 'react'
import { api, User } from '../api'

interface Props {
  user: User
  setUser: (u: User) => void
  onSearch: (plate: string) => void
  onLogout: () => void
}

export default function HomePage({ user, onSearch, onLogout }: Props) {
  const [plate, setPlate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const quota = user.searches_quota
  const done = user.searches_done
  const left = user.searches_left
  const pct = quota === -1 ? 100 : Math.max(0, Math.round((left / quota) * 100))

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🚗 CarReports</div>
          <div className="text-muted" style={{ fontSize: 13 }}>{user.full_name || user.email}</div>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
          יציאה
        </button>
      </div>

      {/* Quota card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>חיפושים זמינים</span>
          {user.is_subscriber && <span className="badge badge-green">מנוי פעיל</span>}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue)', margin: '8px 0' }}>
          {quota === -1 ? '∞' : left}
        </div>
        {quota !== -1 && (
          <>
            <div className="quota-bar">
              <div className="quota-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>{done} מתוך {quota} שומשו</div>
          </>
        )}
      </div>

      {/* Search */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>חפש רכב לפי לוחית רישוי</div>
        <input
          className="plate-input"
          type="text"
          placeholder="12-345-67"
          value={plate}
          onChange={e => setPlate(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          maxLength={10}
          autoFocus
        />
        {error && <p className="error-msg text-center mt-2">{error}</p>}
        <button
          className="btn btn-primary mt-4"
          onClick={handleSearch}
          disabled={loading || !plate.trim() || left === 0}
        >
          {loading ? 'מחפש...' : '🔍 בדוק רכב'}
        </button>
        {left === 0 && !loading && (
          <p className="text-center text-muted mt-2" style={{ fontSize: 13 }}>נגמרו החיפושים — <a href="#" style={{ color: 'var(--blue)' }}>רכוש חבילה</a></p>
        )}
      </div>
    </div>
  )
}
