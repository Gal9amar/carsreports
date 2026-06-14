import { useState, useEffect, useRef } from 'react'
import { api, Package } from '../api'

interface Props {
  packageId: string
  onBack: () => void
  onDone: () => void
}

export default function PaymentPage({ packageId, onBack, onDone }: Props) {
  const [pkg, setPkg] = useState<Package | null>(null)
  const [ref, setRef] = useState('')
  const [approvalUrl, setApprovalUrl] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [step, setStep] = useState<'init' | 'pay' | 'waiting' | 'done'>('init')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.getPackages().then(pkgs => setPkg(pkgs.find(p => p.id === packageId) || null))
  }, [packageId])

  // Check URL params on load (PayPal return redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const refParam = params.get('ref')
    if (paymentStatus === 'success' && refParam) {
      setRef(refParam)
      setStep('waiting')
      startPolling(refParam)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (paymentStatus === 'cancel') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  function startPolling(orderRef: string) {
    let count = 0
    pollRef.current = setInterval(async () => {
      count++
      setSeconds(count * 3)
      try {
        const status = await api.checkPaymentStatus(orderRef)
        if (status.completed) {
          if (pollRef.current) clearInterval(pollRef.current)
          setStep('done')
        }
      } catch { /* ignore */ }
      if (count > 40) {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 3000)
  }

  async function handleInitiate() {
    setLoading(true)
    setError('')
    try {
      const res = await api.initiatePayment(packageId)
      setRef(res.ref)
      setApprovalUrl(res.approval_url)
      setIsManual(!!res.manual)
      setStep('pay')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenPayPal() {
    window.open(approvalUrl, '_blank')
    setStep('waiting')
    startPolling(ref)
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← חזרה לחבילות
      </button>

      <div style={{ maxWidth: 480 }}>

        {step === 'init' && pkg && (
          <div className="card">
            <div style={{ fontSize: 42, textAlign: 'center', marginBottom: 12 }}>💳</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>אישור רכישה</h2>
            <p className="text-muted text-center" style={{ marginBottom: 24 }}>בדוק את פרטי ההזמנה לפני המשך לתשלום</p>

            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">חבילה</span>
                <span style={{ fontWeight: 600 }}>{pkg.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">חיפושים</span>
                <span style={{ fontWeight: 600 }}>{pkg.searches === -1 ? 'ללא הגבלה' : pkg.searches}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>סה"כ לתשלום</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--blue)' }}>₪{pkg.price}</span>
              </div>
            </div>

            {error && <p className="error-msg mb-4">{error}</p>}

            <button className="btn btn-primary btn-full btn-lg" onClick={handleInitiate} disabled={loading}>
              {loading ? '⌛ מכין...' : 'המשך לתשלום עם PayPal →'}
            </button>
            <p className="text-muted text-center" style={{ fontSize: 12, marginTop: 10 }}>
              מאובטח על ידי PayPal · לא שומרים פרטי כרטיס
            </p>
          </div>
        )}

        {step === 'pay' && (
          <div className="card text-center">
            <div style={{ fontSize: 52, marginBottom: 12 }}>💳</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>מוכן לתשלום</h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              {isManual
                ? 'לחץ לפתיחת PayPal. לאחר התשלום, שלח screenshot לאדמין לאישור ידני.'
                : 'לחץ כדי להמשיך לתשלום ב-PayPal. לאחר התשלום תחזור אוטומטית לכאן.'}
            </p>

            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 20px', marginBottom: 20, fontSize: 14 }}>
              <span className="text-muted">מזהה הזמנה: </span>
              <strong style={{ fontFamily: 'monospace' }}>{ref}</strong>
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleOpenPayPal}
              style={{ background: '#003087', fontSize: 16 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 3.993-.032.17a.804.804 0 0 1-.794.679H7.72a.483.483 0 0 1-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.752-6.198l.044-.304zM4.862 5.76a.483.483 0 0 1 .477-.557h5.44c1.35 0 2.608.201 3.706.617.355.135.682.294.98.476.26.165.494.347.703.543.272.257.522.556.748.893.317-.055.605-.138.862-.248C16.37 3.44 14.354 2 11.16 2H5.057A1.046 1.046 0 0 0 4.02 3.173L2 16.785a.629.629 0 0 0 .621.715H5.88l.982-6.232.983-5.508z"/>
              </svg>
              שלם עם PayPal
            </button>
          </div>
        )}

        {step === 'waiting' && (
          <div className="card text-center">
            <div style={{ width: 64, height: 64, border: '4px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>מחכים לאישור</h2>
            <p className="text-muted" style={{ marginBottom: 8 }}>
              {isManual
                ? 'המנהל יאשר את התשלום ידנית בקרוב והחיפושים יתווספו לחשבונך.'
                : 'לאחר השלמת התשלום ב-PayPal, האישור יתבצע אוטומטית תוך שניות.'}
            </p>
            {!isManual && seconds > 0 && (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>בדיקה... ({seconds}ש')</p>
            )}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 }}>
              מזהה הזמנה: <strong style={{ fontFamily: 'monospace' }}>{ref}</strong>
            </div>
            {!isManual && (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                טרם הגיע לאתר אישור מ-PayPal? {' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => window.open(approvalUrl, '_blank')}
                >חזור ל-PayPal</button>
              </p>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="card text-center">
            <div style={{ fontSize: 72, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>תשלום אושר!</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              החיפושים נוספו לחשבונך. תודה על הרכישה!
            </p>
            <button className="btn btn-primary btn-full btn-lg" onClick={onDone}>
              התחל לחפש רכבים →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
