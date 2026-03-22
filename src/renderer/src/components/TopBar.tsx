import { useState, useEffect } from 'react'
import { getStatus, type AgentStatus } from '../lib/api'

function useCountdown(seconds: number): string {
  const [rem, setRem] = useState(seconds)
  useEffect(() => {
    const i = setInterval(() => setRem((p) => (p <= 1 ? seconds : p - 1)), 1000)
    return () => clearInterval(i)
  }, [seconds])
  const m = Math.floor(rem / 60)
  const s = rem % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TopBarProps {
  onSearch?: (q: string) => void
  searchPlaceholder?: string
  actions?: React.ReactNode
}

export default function TopBar({
  onSearch,
  searchPlaceholder = 'Search...',
  actions
}: TopBarProps): React.JSX.Element {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [query, setQuery] = useState('')
  const countdown = useCountdown(1800)

  useEffect(() => {
    getStatus().then(setStatus).catch(console.error)
    const i = setInterval(() => getStatus().then(setStatus).catch(console.error), 15000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="topbar">
      <div className="topbar-search">
        <span className="topbar-search-icon">⌕</span>
        <input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value) }}
        />
      </div>

      <div className="topbar-spacer" />

      <div className="topbar-pill">
        <div className={`topbar-dot ${status?.status === 'active' ? 'active' : ''}`} />
        <span>{status?.current_activity ?? 'No activity'}</span>
      </div>

      <div className="topbar-pill">
        <span className="topbar-pill-label">NEXT</span>
        <span className="topbar-mono">{countdown}</span>
      </div>

      {actions}
    </div>
  )
}
