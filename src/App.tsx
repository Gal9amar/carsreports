import { useState, useEffect } from 'react'
import { api, User } from './api'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ReportPage from './pages/ReportPage'
import HistoryPage from './pages/HistoryPage'
import PackagesPage from './pages/PackagesPage'
import PaymentPage from './pages/PaymentPage'
import Sidebar from './components/Sidebar'
import AdminPage from './pages/AdminPage'
import TicketsPage from './pages/TicketsPage'
import ReferralPage from './pages/ReferralPage'
import WatchesPage from './pages/WatchesPage'

export type Page = 'home' | 'report' | 'history' | 'packages' | 'payment' | 'admin' | 'tickets' | 'referral' | 'watches'

const PAGE_TITLES: Record<Page, string> = {
  home: 'בדיקת רכב',
  report: 'דוח רכב',
  history: 'היסטוריית חיפושים',
  packages: 'חבילות ומחירים',
  payment: 'תשלום',
  admin: 'לוח ניהול',
  tickets: 'תמיכה',
  referral: 'הזמן חברים',
  watches: 'רכבים שמורים',
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('home')
  const [plate, setPlate] = useState('')
  const [paymentPackageId, setPaymentPackageId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('cr_token')
    if (!token) { setLoading(false); return }
    api.getUser()
      .then(setUser)
      .catch(() => localStorage.removeItem('cr_token'))
      .finally(() => setLoading(false))
  }, [])

  function handleLogin(token: string, u: User) {
    localStorage.setItem('cr_token', token)
    setUser(u)
  }

  function handleLogout() {
    localStorage.removeItem('cr_token')
    setUser(null)
    setPage('home')
  }

  function goReport(p: string) {
    setPlate(p)
    setPage('report')
  }

  function goPayment(pkgId: string) {
    setPaymentPackageId(pkgId)
    setPage('payment')
  }

  if (loading) return <div className="spinner" style={{ marginTop: '40vh' }} />

  if (!user) return <LoginPage onLogin={handleLogin} />

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        current={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-area">
        <header style={{
          height: 64,
          background: '#fff',
          borderBottom: '1.5px solid #dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          gap: 16,
        }}>
          {/* Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 22,
                color: '#1e1b4b',
                padding: 4,
                lineHeight: 1,
              }}
            >☰</button>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
              {PAGE_TITLES[page]}
            </h1>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.is_subscriber
              ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#dcfce7', color: '#166534',
                  borderRadius: 99, padding: '4px 12px',
                  fontSize: 12, fontWeight: 700,
                }}>⭐ מנוי פעיל</span>
              )
              : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#dbeafe', color: '#1e40af',
                  borderRadius: 99, padding: '4px 12px',
                  fontSize: 12, fontWeight: 700,
                }}>{user.searches_left} חיפושים</span>
              )
            }

            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}>
                {(user.full_name || user.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>
                {user.full_name || user.email}
              </span>
            </div>
          </div>
        </header>

        <main style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div className="page-content">
            {page === 'home' && <HomePage user={user} setUser={setUser} onSearch={goReport} onLogout={handleLogout} onBuyMore={() => setPage('packages')} />}
            {page === 'report' && <ReportPage plate={plate} user={user} onBack={() => setPage('home')} onBuyMore={() => setPage('packages')} />}
            {page === 'history' && <HistoryPage onSelect={goReport} />}
            {page === 'packages' && <PackagesPage onSelect={goPayment} />}
            {page === 'payment' && <PaymentPage packageId={paymentPackageId} onBack={() => setPage('packages')} onDone={() => setPage('home')} />}
            {page === 'admin' && user.is_admin && <AdminPage />}
            {page === 'tickets' && <TicketsPage />}
            {page === 'referral' && <ReferralPage />}
            {page === 'watches' && <WatchesPage onViewReport={(p) => { setPlate(p); setPage('report') }} />}
          </div>
        </main>
      </div>
    </div>
  )
}
