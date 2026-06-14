import { useState, useEffect } from 'react'
import { api, HistoryItem } from '../api'

interface Props { onSelect: (plate: string) => void }

export default function HistoryPage({ onSelect }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getHistory().then(setItems).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">היסטוריית חיפושים</h1>
      {loading && <div className="spinner" />}
      {!loading && items.length === 0 && (
        <div className="card text-center">
          <p className="text-muted">עדיין לא ביצעת חיפושים</p>
        </div>
      )}
      {items.map(item => (
        <button
          key={item.plate + item.searched_at}
          className="card"
          style={{ width: '100%', textAlign: 'right', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => onSelect(item.plate)}
        >
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 2 }}>{item.plate}</span>
          <span className="text-muted" style={{ fontSize: 13 }}>{new Date(item.searched_at).toLocaleDateString('he-IL')}</span>
        </button>
      ))}
    </div>
  )
}
