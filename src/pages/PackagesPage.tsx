import { useState, useEffect } from 'react'
import { api, Package } from '../api'

interface Props { onSelect: (packageId: string) => void }

const TIERS = [
  {
    gradient: 'linear-gradient(135deg, #2563eb, #6366f1)',
    accent: '#bfdbfe',
    icon: '🔍',
    badge: 'מומלץ',
    badgeBg: 'rgba(255,255,255,0.25)',
  },
  {
    gradient: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
    accent: '#93c5fd',
    icon: '⚡',
    badge: 'פופולרי',
    badgeBg: 'rgba(37,99,235,0.4)',
  },
  {
    gradient: 'linear-gradient(135deg, #4c1d95, #6366f1)',
    accent: '#c4b5fd',
    icon: '👑',
    badge: 'הכי שווה',
    badgeBg: 'rgba(99,102,241,0.35)',
  },
]

export default function PackagesPage({ onSelect }: Props) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPackages().then(setPackages).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ direction: 'rtl', fontFamily: 'inherit' }}>
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb, #6366f1)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 32, color: '#fff',
        boxShadow: '0 4px 18px rgba(37,99,235,0.18)', textAlign: 'center',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}>
          💎 רכישת חיפושים
        </h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85, fontWeight: 500 }}>
          בחר חבילה ותתחיל לחפש רכבים ללא הגבלה
        </p>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{
            width: 36, height: 36, border: '4px solid #e0e7ff',
            borderTopColor: '#2563eb', borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {packages.map((pkg, i) => {
          const tier = TIERS[i % TIERS.length]
          return (
            <div
              key={pkg.id}
              style={{
                background: tier.gradient,
                borderRadius: 20,
                padding: '28px 32px',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(37,99,235,0.18)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => onSelect(pkg.id)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px) scale(1.01)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(37,99,235,0.28)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0) scale(1)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(37,99,235,0.18)'
              }}
            >
              {/* Background decoration */}
              <div style={{
                position: 'absolute', top: -20, left: -20,
                width: 120, height: 120, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{tier.icon}</span>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>{pkg.label}</span>
                  <span style={{
                    background: tier.badgeBg,
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  }}>
                    {tier.badge}
                  </span>
                </div>
                <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 500 }}>
                  {pkg.searches === -1 ? '♾️ חיפושים ללא הגבלה' : `🔍 ${pkg.searches} חיפושים`}
                </div>
              </div>

              <div style={{ position: 'relative', textAlign: 'left' }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: tier.accent, lineHeight: 1 }}>
                  ₪{pkg.price}
                </div>
                <div style={{
                  marginTop: 10,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  borderRadius: 10, padding: '8px 18px',
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                }}>
                  בחר חבילה ←
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
