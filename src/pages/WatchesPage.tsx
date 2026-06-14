import { useState, useEffect } from 'react'
import { api, WatchItem } from '../api'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1.5px solid #e0e7ff',
  padding: 20,
  transition: 'box-shadow 0.18s, transform 0.15s',
}

const btnGradient: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2563eb, #6366f1)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 13,
}

const btnSecondary: React.CSSProperties = {
  background: '#f1f5f9',
  color: '#374151',
  border: '1px solid #e0e7ff',
  borderRadius: 10,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 13,
}

const btnDanger: React.CSSProperties = {
  background: '#fff1f2',
  color: '#ef4444',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 13,
}

export default function WatchesPage() {
  const [watches, setWatches] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    api.getWatches()
      .then(setWatches)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleRemove(id: number) {
    try {
      await api.removeWatch(id)
      setWatches(ws => ws.filter(w => w.id !== id))
    } catch {
      // ignore
    }
  }

  async function handleToggle(id: number) {
    try {
      const result = await api.toggleWatch(id)
      setWatches(ws => ws.map(w => w.id === id ? { ...w, active: result.active } : w))
    } catch {
      // ignore
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!make.trim()) { setAddError('נדרש יצרן'); return }
    setAdding(true)
    setAddError('')
    try {
      await api.addWatch(make.trim(), model.trim() || undefined, year ? parseInt(year, 10) : undefined)
      const updated = await api.getWatches()
      setWatches(updated)
      setShowAdd(false)
      setMake('')
      setModel('')
      setYear('')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
      <div style={{
        width: 36, height: 36, border: '4px solid #e0e7ff',
        borderTopColor: '#2563eb', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )

  return (
    <div style={{ direction: 'rtl', fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb, #6366f1)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 28, color: '#fff',
        boxShadow: '0 4px 18px rgba(37,99,235,0.18)',
      }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>🔔 התראות יד2</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, opacity: 0.85, fontWeight: 500 }}>
          קבל עדכונים על מכוניות חדשות ביד2 לפי יצרן, דגם ושנה
        </p>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          background: '#eff6ff', color: '#2563eb', fontWeight: 700,
          fontSize: 13, padding: '4px 12px', borderRadius: 20, border: '1px solid #bfdbfe',
        }}>
          {watches.length} מעקבים פעילים
        </span>
        <button style={btnGradient} onClick={() => { setShowAdd(s => !s); setAddError('') }}>
          {showAdd ? 'ביטול' : '+ הוסף מעקב'}
        </button>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>הוסף מעקב חדש</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>יצרן *</label>
              <input
                value={make}
                onChange={e => setMake(e.target.value)}
                placeholder="לדוג' יונדאי"
                style={{ border: '1.5px solid #e0e7ff', borderRadius: 8, padding: '7px 12px', fontSize: 14, outline: 'none', minWidth: 130 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>דגם</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="לדוג' TUCSON"
                style={{ border: '1.5px solid #e0e7ff', borderRadius: 8, padding: '7px 12px', fontSize: 14, outline: 'none', minWidth: 130 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>שנה</label>
              <input
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="לדוג' 2018"
                type="number"
                min={1990}
                max={new Date().getFullYear() + 1}
                style={{ border: '1.5px solid #e0e7ff', borderRadius: 8, padding: '7px 12px', fontSize: 14, outline: 'none', width: 90 }}
              />
            </div>
            <button type="submit" style={btnGradient} disabled={adding}>
              {adding ? 'שומר...' : 'שמור'}
            </button>
          </form>
          {addError && <p style={{ color: '#ef4444', fontSize: 13, margin: '10px 0 0' }}>{addError}</p>}
        </div>
      )}

      {watches.length === 0 ? (
        <div style={{
          ...cardStyle,
          textAlign: 'center', padding: '56px 32px',
          background: 'linear-gradient(160deg, #f8faff 0%, #eef2ff 100%)',
        }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🔔</div>
          <p style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', margin: '0 0 8px' }}>
            אין מעקבים פעילים
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            הוסף מעקב לקבלת התראות על מכוניות חדשות ביד2
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {watches.map(w => (
            <div key={w.id} style={{ ...cardStyle, opacity: w.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>{w.make}</div>
                  {w.model && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{w.model}</div>}
                  {w.year && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{w.year}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    title={w.active ? 'השהה מעקב' : 'הפעל מעקב'}
                    onClick={() => handleToggle(w.id)}
                    style={{
                      ...btnSecondary,
                      padding: '5px 10px',
                      fontSize: 13,
                      color: w.active ? '#2563eb' : '#9ca3af',
                    }}
                  >
                    {w.active ? '⏸' : '▶'}
                  </button>
                  <button
                    title="מחק מעקב"
                    onClick={() => handleRemove(w.id)}
                    style={btnDanger}
                  >🗑️</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{
                  fontSize: 11,
                  background: w.active ? '#dcfce7' : '#f1f5f9',
                  color: w.active ? '#16a34a' : '#9ca3af',
                  padding: '2px 10px', borderRadius: 20, fontWeight: 700,
                }}>
                  {w.active ? 'פעיל' : 'מושהה'}
                </span>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                  {new Date(w.created_at).toLocaleDateString('he-IL')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
