import { Page } from '../App'
import { User } from '../api'

interface Props {
  user: User
  current: Page
  onNavigate: (p: Page) => void
  onLogout: () => void
  open: boolean
  onClose: () => void
}

const NAV_ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'home',     icon: '🔍', label: 'בדיקת רכב' },
  { page: 'history',  icon: '📋', label: 'היסטוריה' },
  { page: 'watches',  icon: '⭐', label: 'רכבים שמורים' },
  { page: 'referral', icon: '🤝', label: 'הזמן חברים' },
  { page: 'tickets',  icon: '🎫', label: 'תמיכה' },
  { page: 'packages', icon: '📦', label: 'חבילות' },
]

export default function Sidebar({ user, current, onNavigate, onLogout, open, onClose }: Props) {
  const initials = (user.full_name || user.email || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} style={{
        width: 260,
        background: '#0f172a',
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '-4px 0 32px rgba(37,99,235,0.18)',
        overflowY: 'auto',
        transition: 'transform 0.25s',
      }}>

        {/* Logo */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid rgba(59,130,246,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          }}>🚗</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>CarsReports</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>בדיקת רכבים</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase', letterSpacing: 1.5,
            padding: '8px 8px 6px',
          }}>תפריט ראשי</div>

          {NAV_ITEMS.map(({ page, icon, label }) => {
            const isActive = current === page
            return (
              <button
                key={page}
                onClick={() => { onNavigate(page); onClose() }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  marginBottom: 2,
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  textAlign: 'right',
                  transition: 'all 0.15s',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.62)',
                  background: isActive
                    ? 'linear-gradient(135deg, #2563eb, #6366f1)'
                    : 'transparent',
                  boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.38)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                {label}
              </button>
            )
          })}

          {user.is_admin && (
            <>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)',
                textTransform: 'uppercase', letterSpacing: 1.5,
                padding: '12px 8px 6px',
              }}>ניהול</div>
              {(() => {
                const isActive = current === 'admin'
                return (
                  <button
                    onClick={() => { onNavigate('admin' as Page); onClose() }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      marginBottom: 2,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      textAlign: 'right',
                      transition: 'all 0.15s',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.62)',
                      background: isActive
                        ? 'linear-gradient(135deg, #2563eb, #6366f1)'
                        : 'transparent',
                      boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.38)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>⚙️</span>
                    לוח ניהול
                  </button>
                )
              })()}
            </>
          )}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: 16 }}>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.full_name || user.email}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
                {user.is_subscriber
                  ? <span style={{ color: '#86efac' }}>⭐ מנוי פעיל</span>
                  : `${user.searches_left} חיפושים נותרו`}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 14px',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              textAlign: 'right',
              background: 'transparent',
              color: 'rgba(255,120,120,0.72)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.12)'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#fca5a5'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,120,120,0.72)'
            }}
          >
            <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>🚪</span>
            התנתקות
          </button>
        </div>
      </aside>
    </>
  )
}
