import { useState, useEffect } from 'react'
import { api, User } from '../api'

interface Props {
  onLogin: (token: string, user: User) => void
}

type Step = 'choose' | 'email' | 'otp'

// Minimal Google Identity Services types
interface GoogleCredentialResponse {
  credential: string
}

interface GoogleButtonConfig {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  width?: number
  text?: string
  locale?: string
}

interface GoogleAccounts {
  id: {
    initialize: (config: { client_id: string; callback: (res: GoogleCredentialResponse) => void }) => void
    renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void
  }
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts }
  }
}

function getRefParam(): string | undefined {
  const params = new URLSearchParams(window.location.search)
  return params.get('ref') ?? undefined
}

const STEP_ORDER: Step[] = ['choose', 'email', 'otp']

/* ─── inline styles ─── */
const S = {
  root: {
    display: 'flex' as const,
    minHeight: '100vh',
    direction: 'rtl' as const,
    fontFamily: "'Segoe UI', 'Noto Sans Hebrew', Arial, sans-serif",
  },
  /* LEFT HERO */
  hero: {
    flex: '0 0 52%',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: '60px 56px',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  heroInner: {
    maxWidth: 500,
    width: '100%',
    position: 'relative' as const,
    zIndex: 1,
  },
  heroIcon: {
    fontSize: 60,
    lineHeight: 1,
    marginBottom: 24,
    display: 'block' as const,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.1,
    margin: '0 0 12px',
    letterSpacing: '-0.5px',
  },
  heroSub: {
    fontSize: 20,
    color: '#bfdbfe', // blue-200
    marginBottom: 40,
    fontWeight: 500,
  },
  bullet: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 14,
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: '13px 18px',
    marginBottom: 10,
  },
  bulletIcon: { fontSize: 22, flexShrink: 0 },
  bulletText: { color: '#e0e7ff', fontSize: 15, fontWeight: 600 },
  heroFooter: {
    marginTop: 40,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  heroLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' },
  heroFooterText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  /* RIGHT FORM */
  formPanel: {
    flex: 1,
    background: '#fff',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: '40px 24px',
    overflowY: 'auto' as const,
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#1e1b4b',
    marginBottom: 6,
    margin: '0 0 6px',
  },
  formSub: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 36,
  },
  /* Step indicator */
  stepRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 36,
  },
  stepDot: (active: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    fontSize: 13,
    fontWeight: 800,
    background: active ? 'linear-gradient(135deg, #2563eb, #6366f1)' : '#e0e7ff',
    color: active ? '#fff' : '#a5b4fc',
    transition: 'background 0.3s',
  }),
  stepLine: (active: boolean) => ({
    width: 52,
    height: 2,
    background: active ? 'linear-gradient(90deg,#2563eb,#6366f1)' : '#e0e7ff',
    transition: 'background 0.3s',
  }),
  /* Google button */
  googleBtn: {
    width: '100%',
    padding: '13px 20px',
    border: '1.5px solid #dadce0',
    borderRadius: 10,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 700,
    color: '#3c4043',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginBottom: 12,
    transition: 'box-shadow 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  appleBtn: {
    width: '100%',
    padding: '13px 20px',
    borderRadius: 10,
    background: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginBottom: 24,
  },
  divider: {
    textAlign: 'center' as const,
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    position: 'relative' as const,
  },
  emailBtn: {
    width: '100%',
    padding: '13px 20px',
    borderRadius: 10,
    background: '#eff6ff',
    border: '1.5px solid #bfdbfe',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 10,
    background: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
    border: 'none',
    color: '#fff',
    fontWeight: 800,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 20,
    boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
    transition: 'opacity 0.2s',
  },
  primaryBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed' as const,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '13px 16px',
    border: '1.5px solid #c7d2fe',
    borderRadius: 10,
    fontSize: 16,
    outline: 'none',
    marginTop: 6,
    fontFamily: 'inherit',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    display: 'block' as const,
    marginBottom: 4,
  },
  errorMsg: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
    padding: '8px 12px',
    background: '#fef2f2',
    borderRadius: 8,
    border: '1px solid #fecaca',
  },
  otpInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    textAlign: 'center' as const,
    fontSize: 38,
    letterSpacing: 10,
    fontFamily: 'monospace',
    padding: '16px 12px',
    border: '2px solid #c7d2fe',
    borderRadius: 12,
    outline: 'none',
    color: '#1e1b4b',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 20,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 4,
    padding: 0,
  },
  adminLink: {
    background: 'none',
    border: 'none',
    color: '#d1d5db',
    cursor: 'pointer',
    width: '100%',
    marginTop: 32,
    fontSize: 12,
    padding: '4px 0',
    textAlign: 'center' as const,
  },
  tos: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 32,
    lineHeight: 1.6,
  },
}

export default function LoginPage({ onLogin }: Props) {
  const [step, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ref] = useState<string | undefined>(getRefParam)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  useEffect(() => {
    if (!googleClientId) return

    const scriptId = 'gsi-script'
    if (document.getElementById(scriptId)) {
      initGoogleSignIn()
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogleSignIn
    document.head.appendChild(script)

    function initGoogleSignIn() {
      if (!window.google) return
      window.google.accounts.id.initialize({
        client_id: googleClientId!,
        callback: handleGoogleResponse,
      })
      const btn = document.getElementById('google-signin-btn')
      if (btn) {
        window.google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          width: 380,
          text: 'signin_with',
          locale: 'he',
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, step])

  async function handleGoogleResponse(response: GoogleCredentialResponse) {
    setError('')
    setLoading(true)
    try {
      const { token, user } = await api.googleLogin(response.credential)
      onLogin(token, user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בכניסה עם Google')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.sendOtp(email)
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally { setLoading(false) }
  }

  async function handleVerifyOtp() {
    setError('')
    setLoading(true)
    try {
      const { token, user } = await api.verifyOtp(email, code, ref)
      onLogin(token, user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally { setLoading(false) }
  }

  const visibleSteps = STEP_ORDER
  const currentStepIdx = STEP_ORDER.indexOf(step)

  return (
    <div style={S.root}>
      {/* ── LEFT HERO ── */}
      <div style={S.hero}>
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 380, height: 380,
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.18)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 300, height: 300,
          borderRadius: '50%',
          background: 'rgba(37,99,235,0.2)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }} />

        <div style={S.heroInner}>
          <span style={S.heroIcon}>🚗</span>

          <h1 style={S.heroTitle}>CarsReports</h1>
          <p style={S.heroSub}>בדיקת רכבים מקצועית בישראל</p>

          <div style={{ marginBottom: 40 }}>
            {[
              ['✅', 'נתונים ממשרד התחבורה בזמן אמת'],
              ['💰', 'מחיר שוק מ-Yad2'],
              ['📋', 'היסטוריית בעלויות מלאה'],
              ['🔔', 'התראות ריקול'],
            ].map(([icon, text]) => (
              <div key={text} style={S.bullet}>
                <span style={S.bulletIcon}>{icon}</span>
                <span style={S.bulletText}>{text}</span>
              </div>
            ))}
          </div>

          <div style={S.heroFooter}>
            <div style={S.heroLine} />
            <span style={S.heroFooterText}>⭐ מעל 10,000 בדיקות בוצעו</span>
            <div style={S.heroLine} />
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div style={S.formPanel}>
        <div style={S.formCard}>

          {/* Step indicator */}
          {visibleSteps && currentStepIdx >= 0 && (
            <div style={S.stepRow}>
              {visibleSteps.map((s, idx) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={S.stepDot(idx <= currentStepIdx)}>{idx + 1}</div>
                  {idx < visibleSteps.length - 1 && (
                    <div style={S.stepLine(idx < currentStepIdx)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP: choose ── */}
          {step === 'choose' && (
            <>
              <h2 style={S.formTitle}>כניסה / הרשמה</h2>
              <p style={S.formSub}>הזן אימייל לקבלת קוד אימות</p>

              {/* Google button */}
              {googleClientId ? (
                <div id="google-signin-btn" style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }} />
              ) : (
                <button
                  style={{ ...S.googleBtn, opacity: 0.65, cursor: 'not-allowed' }}
                  disabled
                >
                  <svg width="20" height="20" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  המשך עם Google
                </button>
              )}

              {/* Apple button */}
              <button
                style={S.appleBtn}
                onClick={() => setError('כניסה עם Apple תהיה זמינה בקרוב')}
              >
                <svg width="18" height="18" viewBox="0 0 814 1000" fill="white">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.1 0 663 0 541.8c0-207.4 135.4-316.8 269-316.8 65.6 0 120.1 43.3 161.3 43.3 39.5 0 101.1-46.8 176.3-46.8 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                </svg>
                המשך עם Apple
              </button>

              <div style={S.divider}>— או —</div>

              <button
                style={S.emailBtn}
                onClick={() => setStep('email')}
              >
                📧 המשך עם אימייל
              </button>

              {error && <p style={S.errorMsg}>{error}</p>}
            </>
          )}

          {/* ── STEP: email ── */}
          {step === 'email' && (
            <>
              <button style={S.backBtn} onClick={() => { setStep('choose'); setError('') }}>
                ← חזרה
              </button>
              <h2 style={S.formTitle}>כניסה עם אימייל</h2>
              <p style={S.formSub}>נשלח אליך קוד אימות בן 6 ספרות</p>

              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>כתובת אימייל</label>
                <input
                  style={S.input}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                  autoFocus
                  dir="ltr"
                />
              </div>

              {error && <p style={S.errorMsg}>{error}</p>}

              <button
                style={{
                  ...S.primaryBtn,
                  ...(loading || !email ? S.primaryBtnDisabled : {}),
                }}
                onClick={handleSendOtp}
                disabled={loading || !email}
              >
                {loading ? '⌛ שולח...' : 'שלח קוד אימות →'}
              </button>
            </>
          )}

          {/* ── STEP: otp ── */}
          {step === 'otp' && (
            <>
              <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>📬</div>
              <h2 style={{ ...S.formTitle, textAlign: 'center' }}>בדוק את המייל שלך</h2>
              <p style={{ ...S.formSub, textAlign: 'center', lineHeight: 1.6 }}>
                שלחנו קוד בן 6 ספרות אל<br />
                <strong style={{ color: '#1e1b4b' }}>{email}</strong>
              </p>

              <input
                style={S.otpInput}
                type="tel"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && code.length === 6 && handleVerifyOtp()}
                autoFocus
                dir="ltr"
              />

              {error && <p style={{ ...S.errorMsg, textAlign: 'center' }}>{error}</p>}

              <button
                style={{
                  ...S.primaryBtn,
                  ...(loading || code.length !== 6 ? S.primaryBtnDisabled : {}),
                }}
                onClick={handleVerifyOtp}
                disabled={loading || code.length !== 6}
              >
                {loading ? '⌛ מאמת...' : 'כניסה →'}
              </button>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: 16,
                  fontSize: 13,
                  color: '#6366f1',
                  textDecoration: 'underline',
                  fontWeight: 600,
                }}
                onClick={() => { setCode(''); setError(''); handleSendOtp() }}
              >
                שלח קוד מחדש
              </button>
            </>
          )}

          <p style={S.tos}>
            בהמשך אתה מסכים לתנאי השימוש ומדיניות הפרטיות
          </p>
        </div>
      </div>
    </div>
  )
}
