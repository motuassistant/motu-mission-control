import { useEffect, useState } from 'react'
import { getStatus, type AgentStatus } from '../lib/api'
import { useSearch } from '../lib/SearchContext'

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
  searchPlaceholder?: string
  searchDisabled?: boolean
  actions?: React.ReactNode
}

export default function TopBar({
  searchPlaceholder = 'Search...',
  searchDisabled = false,
  actions
}: TopBarProps): React.JSX.Element {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const countdown = useCountdown(1800)
  const { query, setQuery } = useSearch()

  useEffect(() => {
    getStatus().then(setStatus).catch(console.error)
    const i = setInterval(() => getStatus().then(setStatus).catch(console.error), 8000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="topbar">
      <div className={`topbar-search ${searchDisabled ? 'topbar-search-disabled' : ''}`}>
        <span className="topbar-search-icon">⌕</span>
        <input
          placeholder={searchDisabled ? 'No search on this page' : searchPlaceholder}
          value={query}
          onChange={(e) => !searchDisabled && setQuery(e.target.value)}
          disabled={searchDisabled}
          style={{ opacity: searchDisabled ? 0.4 : 1 }}
        />
        {query && !searchDisabled && (
          <button
            onClick={() => setQuery('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gh-text-4)', fontSize: 11, padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
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
