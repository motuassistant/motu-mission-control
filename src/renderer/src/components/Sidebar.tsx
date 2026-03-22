import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getTasks, type Task } from '../lib/api'

const NAV = [
  {
    section: 'MAIN',
    items: [
      { label: 'Dashboard',     icon: '◈', path: '/dashboard' },
      { label: 'Journal',       icon: '◎', path: '/journal' },
      { label: 'Documents',     icon: '❑', path: '/documents' }
    ]
  },
  {
    section: 'MOTU',
    items: [
      { label: 'Agents',        icon: '◉', path: '/agents' },
      { label: 'Intelligence',  icon: '◆', path: '/intelligence' },
      { label: 'The Hub',       icon: '⬡', path: '/hub' },
      { label: 'Weekly Recaps', icon: '↻', path: '/weekly-recaps' }
    ]
  },
  {
    section: 'BUSINESS',
    items: [
      { label: 'Clients',   icon: '◻', path: '/clients' },
      { label: 'Cron Jobs', icon: '◷', path: '/cron-jobs' },
      { label: 'API Usage', icon: '▲', path: '/api-usage' },
      { label: 'Workshop',  icon: '⚙', path: '/workshop', badge: true }
    ]
  }
]

export default function Sidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    const load = () =>
      getTasks()
        .then((tasks: Task[]) =>
          setQueueCount(tasks.filter((t) => t.status === 'queued').length)
        )
        .catch(console.error)
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="agent-avatar-wrap">
          <div className="agent-avatar">🤖</div>
          <div className="agent-avatar-dot" />
        </div>
        <div className="agent-info">
          <div className="agent-name">Motu</div>
          <div className="agent-role">Commander · Idle</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <div
                key={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && queueCount > 0 && (
                  <span className="nav-badge">{queueCount}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">v1.0.0 · ragpedia.net</div>
      </div>
    </aside>
  )
}
