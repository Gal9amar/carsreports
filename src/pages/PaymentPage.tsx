import { useState, useEffect } from 'react'
import { api, Package } from '../api'

interface Props {
  packageId: string
  onBack: () => void
  onDone: () => void
}

export default function PaymentPage({ packageId, onBack, onDone }: Props) {
  const [pkg, setPkg] = useState<Package | null>(null)
  const [ref, setRef] = useState('')
  const [paypalUrl, setPaypalUrl] = useState('')
  const [step, setStep] = useState<'init' | 'pay' | 'confirm' | 'done'>('init')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getPackages().then(pkgs => setPkg(pkgs.find(p => p.id === packageId) || null))
  }, [packageId])

  async function handleInitiate() {
    setLoading(true)
    setError('')
    try {
      const res = await api.initiatePayment(packageId)
      setRef(res.ref)
      setPaypalUrl(res.paypal_url)
      setStep('pay')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await api.confirmPayment(ref)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
        ← חזרה
      </button>
      <h1 className="page-title">רכישה</h1>

      {step === 'init' && pkg && (
        <div className="card">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{pkg.label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--blue)', margin: '8px 0' }}>₪{pkg.price}</div>
          <div className="text-muted">{pkg.searches === -1 ? 'מנוי חודשי — חיפושים ללא הגבלה' : `${pkg.searches} חיפושים`}</div>
          {error && <p className="error-msg mt-2">{error}</p>}
          <button className="btn btn-primary mt-4" onClick={handleInitiate} disabled={loading}>
            {loading ? 'מכין...' : 'המשך לתשלום'}
          </button>
        </div>
      )}

      {step === 'pay' && (
        <div className="card text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>בצע תשלום</h2>
          <p className="text-muted" style={{ marginBottom: 20 }}>לחץ על הכפתור לתשלום דרך PayPal ולאחר מכן חזור ולחץ "שילמתי"</p>
          <a href={paypalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'flex', marginBottom: 12 }}>
            עבור לתשלום PayPal
          </a>
          <button className="btn btn-secondary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'שולח...' : '✅ שילמתי'}
          </button>
          <p className="text-muted mt-2" style={{ fontSize: 12 }}>מזהה הזמנה: {ref}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="card text-center">
          <div style={{ fontSize: 64 }}>✅</div>
          <h2 style={{ fontWeight: 700, margin: '12px 0 8px' }}>קיבלנו את הודעתך!</h2>
          <p className="text-muted">המנהל יאשר את התשלום בקרוב והחיפושים יתווספו לחשבונך.</p>
          <button className="btn btn-primary mt-4" onClick={onDone}>חזרה לדף הבית</button>
        </div>
      )}
    </div>
  )
}
