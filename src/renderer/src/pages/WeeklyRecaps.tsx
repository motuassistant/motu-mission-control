import { useState, useEffect } from 'react'
import { getTasks, getCommits, getEvents, chat, type Task, type Commit, type SystemEvent } from '../lib/api'
import { useSettings } from '../lib/SettingsContext'

interface Recap {
  id: string
  week: string
  content: string
  tasks_completed: number
  commits_made: number
  created_at: string
}

export default function WeeklyRecaps(): React.JSX.Element {
  const [recaps, setRecaps]         = useState<Recap[]>([])
  const [selected, setSelected]     = useState<Recap | null>(null)
  const [generating, setGenerating] = useState(false)
  const { settings }                = useSettings()

  const ollamaHost = settings.ollama_host ?? 'http://localhost:11434'
  const model      = settings.ollama_model ?? 'llama3'

  useEffect(() => {
    try {
      const stored = localStorage.getItem('motu-recaps')
      if (stored) {
        const parsed = JSON.parse(stored)
        setRecaps(parsed)
        if (parsed.length > 0) setSelected(parsed[0])
      }
    } catch { /* ignore */ }
  }, [])

  function save(newRecaps: Recap[]) {
    setRecaps(newRecaps)
    localStorage.setItem('motu-recaps', JSON.stringify(newRecaps))
  }

  async function generateRecap() {
    setGenerating(true)
    try {
      const [tasks, commits, events] = await Promise.all([getTasks(), getCommits(), getEvents()])

      const completed = (tasks as Task[]).filter((t) => t.status === 'completed')
      const recentCommits = (commits as Commit[]).slice(0, 10)
      const recentEvents = (events as SystemEvent[]).slice(0, 20)

      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 7)
      const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

      const context = `
Tasks completed this period: ${completed.length}
${completed.map((t) => `- ${t.title}`).join('\n')}

Recent commits (${recentCommits.length}):
${recentCommits.map((c) => `- ${c.message}`).join('\n')}

System events:
${recentEvents.map((e) => `- [${e.type}] ${e.text}`).join('\n')}
      `.trim()

      const response = await chat([
        {
          role: 'system',
          content: 'You are Motu, an AI assistant writing a weekly recap. Write a concise, professional weekly recap in a narrative style. Include: what was accomplished, key highlights, and brief outlook. Use markdown formatting with ## headers. Keep it under 400 words.'
        },
        { role: 'user', content: `Generate a weekly recap based on this activity:\n\n${context}` }
      ], model, ollamaHost)

      if (response.message?.content) {
        const recap: Recap = {
          id: Date.now().toString(),
          week: weekLabel,
          content: response.message.content,
          tasks_completed: completed.length,
          commits_made: recentCommits.length,
          created_at: new Date().toISOString()
        }
        const newRecaps = [recap, ...recaps]
        save(newRecaps)
        setSelected(recap)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  function deleteRecap(id: string) {
    const newRecaps = recaps.filter((r) => r.id !== id)
    save(newRecaps)
    setSelected(newRecaps[0] ?? null)
  }

  // Simple markdown renderer
  function renderMarkdown(text: string): React.JSX.Element {
    const lines = text.split('\n')
    const elements: React.JSX.Element[] = []
    lines.forEach((line, i) => {
      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--gh-text-1)', margin: '20px 0 8px', letterSpacing: '-0.01em' }}>{line.slice(3)}</h2>)
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={i} style={{ fontSize: 16, fontWeight: 700, color: 'var(--gh-text-1)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>{line.slice(2)}</h1>)
      } else if (line.startsWith('- ')) {
        elements.push(<li key={i} style={{ fontSize: 13, color: 'var(--gh-text-2)', lineHeight: 1.6, marginLeft: 16, marginBottom: 4, listStyle: 'disc' }}>{line.slice(2)}</li>)
      } else if (line.trim() === '') {
        elements.push(<br key={i} />)
      } else {
        elements.push(<p key={i} style={{ fontSize: 13, color: 'var(--gh-text-2)', lineHeight: 1.7, marginBottom: 8 }}>{line}</p>)
      }
    })
    return <div>{elements}</div>
  }

  return (
    <div className="page" style={{ padding: 0, display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--gh-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(13,17,23,0.3)' }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--gh-border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Weekly Recaps</div>
          <button className="btn btn-orange" style={{ width: '100%', justifyContent: 'center' }} onClick={generateRecap} disabled={generating}>
            {generating ? '⟳ Generating...' : '+ Generate Recap'}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {recaps.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-6) var(--sp-4)' }}><span className="empty-icon">↻</span><span className="empty-text">No recaps yet</span></div>
          ) : recaps.map((recap) => (
            <div key={recap.id}
              onClick={() => setSelected(recap)}
              style={{ padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 'var(--sp-1)', background: selected?.id === recap.id ? 'var(--blue-soft)' : 'transparent', border: `1px solid ${selected?.id === recap.id ? 'var(--blue-border)' : 'transparent'}`, transition: 'all var(--t-fast) var(--ease)' }}
              onMouseEnter={(e) => { if (selected?.id !== recap.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (selected?.id !== recap.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 600, color: selected?.id === recap.id ? 'var(--gh-blue)' : 'var(--gh-text-1)', marginBottom: 3 }}>{recap.week}</div>
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', display: 'flex', gap: 'var(--sp-3)' }}>
                <span>{recap.tasks_completed} tasks</span>
                <span>{recap.commits_made} commits</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{selected.week}</div>
                <div style={{ fontSize: 11, color: 'var(--gh-text-4)', marginTop: 2, display: 'flex', gap: 'var(--sp-4)' }}>
                  <span>{selected.tasks_completed} tasks completed</span>
                  <span>{selected.commits_made} commits</span>
                  <span>Generated {new Date(selected.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => deleteRecap(selected.id)}>Delete</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)' }}>
              {renderMarkdown(selected.content)}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}>
            <span className="empty-icon">↻</span>
            <span className="empty-text">Generate your first weekly recap above. Motu will summarize all completed tasks, commits, and events.</span>
          </div>
        )}
      </div>
    </div>
  )
}
