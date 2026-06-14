import { useEffect, useState } from 'react'
import { api, ReferralItem } from '../api'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1.5px solid #e0e7ff',
  padding: 24,
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
  transition: 'opacity 0.15s',
}

export default function ReferralPage() {
  const [link, setLink] = useState('')
  const [code, setCode] = useState('')
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [totalBonus, setTotalBonus] = useState(0)
  const [referrals, setReferrals] = useState<ReferralItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([api.getReferralLink(), api.getReferralStats()])
      .then(([linkData, statsData]) => {
        setLink(linkData.link)
        setCode(linkData.referral_code)
        setTotalReferrals(statsData.total_referrals)
        setTotalBonus(statsData.total_bonus)
        setReferrals(statsData.referrals)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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

  const bonusPerReferral = totalReferrals > 0 ? totalBonus / totalReferrals : 5

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', direction: 'rtl', fontFamily: 'inherit' }}>

      {/* Hero Card */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb, #6366f1)',
        borderRadius: 20, padding: '36px 36px 32px', marginBottom: 24, color: '#fff',
        boxShadow: '0 6px 24px rgba(37,99,235,0.22)', textAlign: 'center', position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, left: -30, width: 140, height: 140,
          background: 'rgba(255,255,255,0.07)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, right: -20, width: 180, height: 180,
          background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />
        <div style={{ fontSize: 52, marginBottom: 10, position: 'relative' }}>🤝</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, position: 'relative' }}>
          הפנה חברים וקבל חיפושים!
        </h1>
        <p style={{ margin: 0, fontSize: 16, opacity: 0.9, fontWeight: 600, position: 'relative' }}>
          קבל <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: '2px 10px' }}>
            {bonusPerReferral} חיפושים
          </span> לכל חבר שנרשם בקישור שלך
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          background: 'linear-gradient(160deg, #eff6ff 0%, #eef2ff 100%)',
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
            👥 חברים שהצטרפו
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
            {totalReferrals}
          </div>
        </div>
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 100%)',
          border: '1.5px solid #bbf7d0',
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600, marginBottom: 8 }}>
            🔍 חיפושים שהרווחת
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
            {totalBonus}
          </div>
        </div>
      </div>

      {/* Referral Link Card */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
          🔗 הקישור שלך להפניה
        </h2>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>
            קוד ההפניה שלך
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
            border: '2px dashed #a5b4fc',
            borderRadius: 12, padding: '12px 18px',
            fontFamily: 'monospace', fontSize: 24, fontWeight: 900,
            letterSpacing: 4, color: '#2563eb', textAlign: 'center',
          }}>
            {code}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>
            קישור להפניה
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              readOnly
              value={link}
              dir="ltr"
              style={{
                flex: 1,
                border: '1.5px solid #e0e7ff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontFamily: 'monospace',
                direction: 'ltr',
                background: '#f8faff',
                color: '#374151',
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
            <button
              style={{
                ...btnGradient,
                background: copied
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #2563eb, #6366f1)',
              }}
              onClick={handleCopy}
            >
              {copied ? '✅ הועתק!' : '📋 העתק'}
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
          📖 איך זה עובד?
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { step: 1, title: 'שלח את הקישור', desc: 'שתף את הקישור האישי שלך עם חברים' },
            { step: 2, title: 'החבר נרשם', desc: 'החבר שלך נרשם לאתר דרך הקישור שלך' },
            { step: 3, title: 'קבל חיפושים', desc: `מיד לאחר ההרשמה תקבל ${bonusPerReferral} חיפושים לחשבונך` },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                color: '#fff', fontWeight: 900, fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
              }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', marginBottom: 2 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      {referrals.length > 0 && (
        <div style={cardStyle}>
          <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
            📋 היסטוריית הפניות
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e7ff' }}>
                <th style={{ textAlign: 'right', padding: '8px 0', color: '#64748b', fontWeight: 700 }}>אימייל</th>
                <th style={{ textAlign: 'center', padding: '8px 0', color: '#64748b', fontWeight: 700 }}>בונוס</th>
                <th style={{ textAlign: 'left', padding: '8px 0', color: '#64748b', fontWeight: 700 }}>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f4ff' }}>
                  <td style={{ padding: '10px 0', fontWeight: 600, color: '#1e293b' }}>{r.referee_email}</td>
                  <td style={{ padding: '10px 0', textAlign: 'center' }}>
                    <span style={{
                      background: '#dcfce7', color: '#15803d', fontWeight: 700,
                      fontSize: 12, padding: '3px 10px', borderRadius: 20,
                      border: '1px solid #bbf7d0',
                    }}>
                      +{r.bonus}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'left', color: '#94a3b8', fontSize: 12 }}>
                    {new Date(r.joined_at).toLocaleDateString('he-IL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
