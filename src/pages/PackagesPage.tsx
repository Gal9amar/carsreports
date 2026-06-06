import { useState, useEffect } from 'react'
import { api, Package } from '../api'

interface Props { onSelect: (packageId: string) => void }

const TIERS = [
  { gradient: 'linear-gradient(135deg,#1e40af,#0ea5e9)', accent: '#38bdf8' },
  { gradient: 'linear-gradient(135deg,#92400e,#f59e0b)', accent: '#fbbf24' },
  { gradient: 'linear-gradient(135deg,#4c1d95,#a855f7)', accent: '#c084fc' },
]

export default function PackagesPage({ onSelect }: Props) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPackages().then(setPackages).finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">רכישת חיפושים</h1>
      {loading && <div className="spinner" />}
      {packages.map((pkg, i) => {
        const tier = TIERS[i % 3]
        return (
          <div
            key={pkg.id}
            className="card"
            style={{ background: tier.gradient, color: '#fff', cursor: 'pointer' }}
            onClick={() => onSelect(pkg.id)}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>{pkg.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, margin: '8px 0', color: tier.accent }}>
              ₪{pkg.price}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              {pkg.searches === -1 ? 'חיפושים ללא הגבלה' : `${pkg.searches} חיפושים`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
