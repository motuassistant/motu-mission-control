import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStatus, getCommits, getEvents, getTasks,
  type AgentStatus, type Commit, type SystemEvent, type Task
} from '../lib/api'

function timeAgo(d: string): string {
  const date = new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z')
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const DOT_COLORS: Record<string, string> = {
  info: 'var(--gh-blue)', success: 'var(--gh-teal)',
  warn: 'var(--gh-yellow)', error: 'var(--gh-orange)'
}

export default function Dashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const [status, setStatus]   = useState<AgentStatus | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [events, setEvents]   = useState<SystemEvent[]>([])
  const [tasks, setTasks]     = useState<Task[]>([])

  function load() {
    Promise.all([getStatus(), getCommits(), getEvents(), getTasks()])
      .then(([s, c, e, t]) => { setStatus(s); setCommits(c); setEvents(e); setTasks(t) })
      .catch(console.error)
  }

  useEffect(() => {
    load()
    const i = setInterval(load, 8000)
    return () => clearInterval(i)
  }, [])

  const queued    = tasks.filter((t) => t.status === 'queued')
  const active    = tasks.filter((t) => t.status === 'active')
  const completed = tasks.filter((t) => t.status === 'completed')
  const nextTask  = queued[0] ?? null
  const statusKey = status?.status ?? 'idle'

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>

        {/* Agent status */}
        <div className="glass-card anim-in" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <span className={`badge badge-${statusKey}`}>{statusKey}</span>
            <span style={{ fontSize: 10, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Motu · Agent Status
            </span>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>
              Current Activity
            </div>
            <div style={{ fontSize: 13, color: 'var(--gh-text-1)', fontWeight: 600 }}>
              {status?.current_activity ?? '—'}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Bandwidth</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gh-text-2)' }}>{status?.bandwidth ?? 0}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${status?.bandwidth ?? 0}%` }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            {[
              { label: 'Load',        value: 'Low',  sub: '50 BPM',   color: 'var(--gh-teal)' },
              { label: 'Last Active', value: status ? timeAgo(status.last_active) : '—', sub: 'heartbeat', color: 'var(--gh-blue)' }
            ].map((s) => (
              <div key={s.label} className="inset-card" style={{ padding: 'var(--sp-3)' }}>
                <div style={{ fontSize: 9, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--gh-text-4)', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 11, color: 'var(--gh-teal)', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gh-teal)', display: 'inline-block', animation: 'pulse 2s infinite', boxShadow: '0 0 6px var(--gh-teal)' }} />
            {statusKey === 'active' ? 'Working on a task' : 'Available for new tasks'}
          </div>
        </div>

        {/* Workshop stats */}
        <div className="glass-card anim-in-2" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>Workshop</span>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => navigate('/workshop')}>
              Open →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
            {[
              { label: 'Queued', num: queued.length,    color: 'var(--gh-yellow)' },
              { label: 'Active', num: active.length,    color: 'var(--gh-teal)' },
              { label: 'Done',   num: completed.length, color: 'var(--gh-blue)' }
            ].map((s) => (
              <div key={s.label} className="inset-card" style={{ padding: 'var(--sp-3)', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color, lineHeight: 1, letterSpacing: '-0.04em', textShadow: `0 0 12px ${s.color}40` }}>{s.num}</div>
                <div style={{ fontSize: 9, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="inset-card" style={{ padding: 'var(--sp-3)' }}>
            <div style={{ fontSize: 9, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>Next for Motu</div>
            {nextTask ? (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gh-text-1)', marginBottom: 6, letterSpacing: '-0.01em' }}>{nextTask.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  {nextTask.momentum > 0 && <span className="momentum">↑{nextTask.momentum}%</span>}
                  <span style={{ fontSize: 10, color: 'var(--gh-text-4)' }}>queued · {new Date(nextTask.created_at).toLocaleDateString()}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--gh-text-4)', fontStyle: 'italic' }}>No tasks queued</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>

        {/* Recent commits */}
        <div className="glass-card anim-in-3" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 'var(--sp-4)' }}>Recent Commits</div>
          {commits.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📭</span><span className="empty-text">No commits yet. Complete a task to see commits here.</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {commits.slice(0, 6).map((c) => (
                <div key={c.id} className="inset-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', padding: 'var(--sp-3)' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'linear-gradient(135deg, var(--gh-blue), var(--gh-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0d1117', boxShadow: '0 0 8px rgba(88,166,255,0.25)' }}>
                    {c.author.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{c.author} · {timeAgo(c.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System events */}
        <div className="glass-card anim-in-4" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 'var(--sp-4)' }}>System Events</div>
          {events.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📡</span><span className="empty-text">No events yet</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {events.slice(0, 7).map((e) => (
                <div key={e.id} className="inset-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_COLORS[e.type] ?? 'var(--gh-blue)', marginTop: 4, flexShrink: 0, boxShadow: `0 0 5px ${DOT_COLORS[e.type] ?? 'var(--gh-blue)'}` }} />
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--gh-text-2)', lineHeight: 1.4 }}>{e.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{new Date(e.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
