import { useState, useEffect } from 'react'
import { api, Ticket, TicketDetail } from '../api'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1.5px solid #e0e7ff',
  padding: 20,
}

const btnGradient: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2563eb, #6366f1)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontWeight: 700,
  padding: '10px 22px',
  cursor: 'pointer',
  fontSize: 14,
  whiteSpace: 'nowrap' as const,
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: '#2563eb',
  border: '1.5px solid #bfdbfe',
  borderRadius: 10,
  fontWeight: 700,
  padding: '8px 18px',
  cursor: 'pointer',
  fontSize: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e0e7ff',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  direction: 'rtl',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#f8faff',
}

function StatusBadge({ status }: { status: string }) {
  const open = status === 'open'
  return (
    <span style={{
      background: open ? '#dcfce7' : '#f1f5f9',
      color: open ? '#15803d' : '#64748b',
      fontWeight: 700,
      fontSize: 12,
      padding: '4px 12px',
      borderRadius: 20,
      border: `1px solid ${open ? '#bbf7d0' : '#e2e8f0'}`,
    }}>
      {open ? '● פתוח' : '○ סגור'}
    </span>
  )
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list')
  const [selected, setSelected] = useState<TicketDetail | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadTickets() {
    setLoading(true)
    setError('')
    try {
      setTickets(await api.getTickets())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    }
    setLoading(false)
  }

  useEffect(() => { loadTickets() }, [])

  async function openTicket(id: string) {
    setDetailLoading(true)
    try {
      const detail = await api.getTicket(id)
      setSelected(detail)
      setView('detail')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    }
    setDetailLoading(false)
  }

  async function createTicket() {
    if (!newSubject.trim() || !newMessage.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await api.createTicket(newSubject.trim(), newMessage.trim())
      setNewSubject('')
      setNewMessage('')
      setView('list')
      await loadTickets()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    }
    setSubmitting(false)
  }

  async function sendReply() {
    if (!replyText.trim() || !selected) return
    setSubmitting(true)
    setError('')
    try {
      await api.replyToTicket(selected.id, replyText.trim())
      setReplyText('')
      const detail = await api.getTicket(selected.id)
      setSelected(detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    }
    setSubmitting(false)
  }

  // ── New Ticket Form ──────────────────────────────────────────
  if (view === 'new') {
    return (
      <div style={{ direction: 'rtl' }}>
        <button style={btnGhost} onClick={() => setView('list')}>
          ← חזרה לרשימה
        </button>

        <div style={{
          background: 'linear-gradient(135deg, #2563eb, #6366f1)',
          borderRadius: 18, padding: '24px 28px', margin: '20px 0 24px', color: '#fff',
          boxShadow: '0 4px 18px rgba(37,99,235,0.18)',
        }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>🎫 פתח פנייה חדשה</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.85 }}>נחזור אליך בהקדם האפשרי</p>
        </div>

        <div style={{ ...cardStyle, maxWidth: 600 }}>
          {error && (
            <div style={{
              background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600,
            }}>{error}</div>
          )}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>נושא</label>
            <input
              style={inputStyle}
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              placeholder="תאר בקצרה את הבעיה..."
            />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>הודעה</label>
            <textarea
              style={{ ...inputStyle, minHeight: 130, resize: 'vertical' }}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="פרט את הבעיה..."
            />
          </div>
          <button
            style={{
              ...btnGradient,
              opacity: (submitting || !newSubject.trim() || !newMessage.trim()) ? 0.6 : 1,
            }}
            onClick={createTicket}
            disabled={submitting || !newSubject.trim() || !newMessage.trim()}
          >
            {submitting ? '⏳ שולח...' : '📨 שלח פנייה'}
          </button>
        </div>
      </div>
    )
  }

  // ── Ticket Detail / Thread ───────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div style={{ direction: 'rtl' }}>
        <button style={btnGhost} onClick={() => setView('list')}>
          ← חזרה לרשימה
        </button>

        <div style={{ margin: '20px 0 24px' }}>
          <div style={{ ...cardStyle, maxWidth: 700 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 800, margin: '0 0 6px', fontSize: 18, color: '#1e293b' }}>{selected.subject}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                  {new Date(selected.created_at).toLocaleString('he-IL')}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {/* Thread */}
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Original message - user */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                    color: '#fff', borderRadius: '16px 16px 4px 16px',
                    padding: '12px 16px', fontSize: 14, fontWeight: 500, lineHeight: 1.5,
                  }}>
                    {selected.message}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>
                    {new Date(selected.created_at).toLocaleString('he-IL')}
                  </div>
                </div>
              </div>

              {selected.replies.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: r.is_admin ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '75%' }}>
                    {r.is_admin && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>
                        🛡️ {r.sender_name}
                      </div>
                    )}
                    <div style={{
                      background: r.is_admin
                        ? 'linear-gradient(135deg, #f0f4ff, #e8ecff)'
                        : 'linear-gradient(135deg, #2563eb, #6366f1)',
                      color: r.is_admin ? '#1e293b' : '#fff',
                      borderRadius: r.is_admin ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                      padding: '12px 16px', fontSize: 14, fontWeight: 500, lineHeight: 1.5,
                      border: r.is_admin ? '1.5px solid #e0e7ff' : 'none',
                    }}>
                      {r.message}
                    </div>
                    <div style={{
                      fontSize: 11, color: '#94a3b8', marginTop: 4,
                      textAlign: r.is_admin ? 'left' : 'right',
                    }}>
                      {new Date(r.created_at).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626',
                borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13,
              }}>{error}</div>
            )}

            {selected.status === 'open' && (
              <div style={{
                display: 'flex', gap: 10,
                borderTop: '1.5px solid #e0e7ff', paddingTop: 16,
              }}>
                <textarea
                  style={{ ...inputStyle, flex: 1, minHeight: 60, resize: 'none' }}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="כתוב תגובה..."
                />
                <button
                  style={{
                    ...btnGradient,
                    alignSelf: 'flex-end',
                    opacity: (submitting || !replyText.trim()) ? 0.6 : 1,
                  }}
                  onClick={sendReply}
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? '...' : '📤 שלח'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── List View ────────────────────────────────────────────────
  return (
    <div style={{ direction: 'rtl' }}>
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb, #6366f1)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 28, color: '#fff',
        boxShadow: '0 4px 18px rgba(37,99,235,0.18)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>🎫 פניות ותמיכה</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, opacity: 0.85, fontWeight: 500 }}>
            נשמח לעזור — נחזור אליך תוך 24 שעות
          </p>
        </div>
        <button
          style={{
            ...btnGradient,
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.5)',
            backdropFilter: 'blur(8px)',
            fontSize: 15,
          }}
          onClick={() => setView('new')}
        >
          + פתח פנייה חדשה
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fff1f2', border: '1px solid #fecaca', color: '#dc2626',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13,
        }}>{error}</div>
      )}

      {(loading || detailLoading) && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <div style={{
            width: 32, height: 32, border: '4px solid #e0e7ff',
            borderTopColor: '#2563eb', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}

      {!loading && tickets.length === 0 && (
        <div style={{
          ...cardStyle,
          textAlign: 'center', padding: '56px 32px',
          background: 'linear-gradient(160deg, #f8faff 0%, #eef2ff 100%)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎫</div>
          <p style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', margin: '0 0 8px' }}>
            אין פניות עדיין
          </p>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 24px' }}>
            פתח קריאת תמיכה חדשה ונחזור אליך בהקדם
          </p>
          <button style={btnGradient} onClick={() => setView('new')}>
            + פתח פנייה חדשה
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tickets.map(t => (
          <div
            key={t.id}
            style={{
              ...cardStyle,
              cursor: 'pointer',
              transition: 'box-shadow 0.18s, transform 0.15s',
            }}
            onClick={() => openTicket(t.id)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(37,99,235,0.13)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
              ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{t.subject}</div>
              <StatusBadge status={t.status} />
            </div>
            <p style={{
              fontSize: 13, color: '#6b7280', margin: '0 0 10px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {t.message}
            </p>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              📅 {new Date(t.created_at).toLocaleDateString('he-IL')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
