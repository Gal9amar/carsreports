import { useState } from 'react'
import { api, User } from '../api'

interface Props {
  onLogin: (token: string, user: User) => void
}

type Step = 'choose' | 'email' | 'otp'

export default function LoginPage({ onLogin }: Props) {
  const [step, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.sendOtp(email)
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setError('')
    setLoading(true)
    try {
      const { token, user } = await api.verifyOtp(email, code)
      onLogin(token, user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    // Google One Tap / Popup flow
    setError('כניסה עם Google תהיה זמינה בקרוב')
  }

  async function handleApple() {
    setError('כניסה עם Apple תהיה זמינה בקרוב')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🚗</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--blue)', marginTop: 8 }}>CarReports</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>בדיקת רכב ישראלית — מהירה ומדויקת</p>
        </div>

        <div className="card">
          {step === 'choose' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>כניסה לחשבון</h2>

              <button className="btn btn-google" onClick={handleGoogle} style={{ marginBottom: 12 }}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
                המשך עם Google
              </button>

              <button className="btn btn-apple" onClick={handleApple} style={{ marginBottom: 20 }}>
                <svg width="18" height="18" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.1 0 663 0 541.8c0-207.4 135.4-316.8 269-316.8 65.6 0 120.1 43.3 161.3 43.3 39.5 0 101.1-46.8 176.3-46.8 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>
                המשך עם Apple
              </button>

              <div className="divider">או</div>

              <button className="btn btn-secondary" onClick={() => setStep('email')}>
                📧 המשך עם אימייל
              </button>

              {error && <p className="error-msg text-center mt-2">{error}</p>}
            </>
          )}

          {step === 'email' && (
            <>
              <button onClick={() => setStep('choose')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
                ← חזרה
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>כניסה עם אימייל</h2>
              <div className="input-group">
                <label>כתובת אימייל</label>
                <input
                  className="input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  autoFocus
                />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary mt-4" onClick={handleSendOtp} disabled={loading || !email}>
                {loading ? 'שולח...' : 'שלח קוד אימות'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>הכנס קוד אימות</h2>
              <p className="text-muted" style={{ marginBottom: 20 }}>שלחנו קוד בן 6 ספרות ל-{email}</p>
              <input
                className="otp-input"
                type="tel"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && code.length === 6 && handleVerifyOtp()}
                autoFocus
              />
              {error && <p className="error-msg text-center mt-2">{error}</p>}
              <button className="btn btn-primary mt-4" onClick={handleVerifyOtp} disabled={loading || code.length !== 6}>
                {loading ? 'מאמת...' : 'כניסה'}
              </button>
              <button
                className="text-muted text-center mt-4"
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: 14 }}
                onClick={() => { setCode(''); setError(''); handleSendOtp() }}
              >
                לא קיבלתי קוד — שלח שוב
              </button>
            </>
          )}
        </div>

        <p className="text-center text-muted" style={{ fontSize: 12, marginTop: 16 }}>
          בהמשך אתה מסכים לתנאי השימוש ומדיניות הפרטיות
        </p>
      </div>
    </div>
  )
}
