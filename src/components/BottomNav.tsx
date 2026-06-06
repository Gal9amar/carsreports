import { Page } from '../App'

interface Props {
  current: Page
  onNavigate: (p: Page) => void
}

const ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'home', icon: '🏠', label: 'בית' },
  { page: 'history', icon: '🕓', label: 'היסטוריה' },
  { page: 'packages', icon: '💎', label: 'חבילות' },
]

export default function BottomNav({ current, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      {ITEMS.map(item => (
        <button
          key={item.page}
          className={`nav-item ${current === item.page ? 'active' : ''}`}
          onClick={() => onNavigate(item.page)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
