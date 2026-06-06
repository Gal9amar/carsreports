import { useState, useEffect } from 'react'
import { api, User } from './api'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ReportPage from './pages/ReportPage'
import HistoryPage from './pages/HistoryPage'
import PackagesPage from './pages/PackagesPage'
import PaymentPage from './pages/PaymentPage'
import BottomNav from './components/BottomNav'

export type Page = 'home' | 'report' | 'history' | 'packages' | 'payment'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('home')
  const [plate, setPlate] = useState('')
  const [paymentPackageId, setPaymentPackageId] = useState('')

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

  const showNav: Page[] = ['home', 'history', 'packages']

  return (
    <>
      {page === 'home' && <HomePage user={user} setUser={setUser} onSearch={goReport} onLogout={handleLogout} />}
      {page === 'report' && <ReportPage plate={plate} onBack={() => setPage('home')} onBuyMore={() => setPage('packages')} />}
      {page === 'history' && <HistoryPage onSelect={goReport} />}
      {page === 'packages' && <PackagesPage onSelect={goPayment} />}
      {page === 'payment' && <PaymentPage packageId={paymentPackageId} onBack={() => setPage('packages')} onDone={() => setPage('home')} />}
      {showNav.includes(page) && <BottomNav current={page} onNavigate={setPage} />}
    </>
  )
}
