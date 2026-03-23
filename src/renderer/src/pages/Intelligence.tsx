import { useState, useEffect } from 'react'
import { chat, getSettings } from '../lib/api'
import { useSearch } from '../lib/SearchContext'

interface IntelItem {
  id: string; title: string; summary: string
  tags: string[]; source: string; relevance: number; created_at: string
}

const TAG_COLORS = ['tag-blue', 'tag-orange', 'tag-purple', 'tag-teal', 'tag-yellow']

export default function Intelligence(): React.JSX.Element {
  const [items, setItems]     = useState<IntelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [query2, setQuery2]   = useState('')
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434')
  const [model, setModel]     = useState('llama3')
  const { query }             = useSearch()

  useEffect(() => {
    getSettings().then((s) => {
      if (s.ollama_host) setOllamaHost(s.ollama_host)
      if (s.ollama_model) setModel(s.ollama_model)
    }).catch(console.error)
    try {
      const stored = localStorage.getItem('motu-intelligence')
      if (stored) setItems(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function save(newItems: IntelItem[]) {
    setItems(newItems)
    localStorage.setItem('motu-intelligence', JSON.stringify(newItems))
  }

  async function research() {
    if (!query2.trim() || loading) return
    setLoading(true)
    try {
      const response = await chat([
        { role: 'system', content: 'You are Motu. Respond ONLY with a valid JSON array, no markdown, no explanation. Structure: [{"title":"string","summary":"string","tags":["tag1"],"source":"string","relevance":85}]' },
        { role: 'user', content: `Research: ${query2}` }
      ], model, ollamaHost)

      if (response.message?.content) {
        try {
          const clean = response.message.content.replace(/```json|```/g, '').trim()
          const parsed = JSON.parse(clean) as any[]
          const newItems: IntelItem[] = parsed.map((item, i) => ({
            id: Date.now() + '_' + i, title: item.title ?? 'Untitled',
            summary: item.summary ?? '', tags: Array.isArray(item.tags) ? item.tags : [],
            source: item.source ?? 'Motu Research', relevance: item.relevance ?? 80,
            created_at: new Date().toISOString()
          }))
          save([...newItems, ...items])
        } catch {
          save([{ id: Date.now() + '_0', title: query2, summary: response.message.content.slice(0, 300), tags: ['research'], source: 'Motu', relevance: 75, created_at: new Date().toISOString() }, ...items])
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setQuery2('') }
  }

  function removeItem(id: string) { save(items.filter((i) => i.id !== id)) }

  // topbar search filters items
  const filtered = items.filter((item) => {
    if (!query) return true
    const q = query.toLowerCase()
    return item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q) || item.tags.some((t) => t.toLowerCase().includes(q))
  })

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="page-header">
        <div>
          <div className="page-title">Intelligence</div>
          <div className="page-subtitle">{filtered.length} item{filtered.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 'var(--sp-5)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gh-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--sp-3)' }}>Ask Motu to Research</div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <input className="input" style={{ flex: 1 }} value={query2} onChange={(e) => setQuery2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && research()} placeholder="e.g. Best practices for RAG pipelines..." />
          <button className="btn btn-orange" onClick={research} disabled={loading || !query2.trim()}>{loading ? 'Researching...' : '◆ Research'}</button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 'var(--sp-2)' }}>Motu will research the topic and add findings to your intelligence database</div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">◆</span><span className="empty-text">{query ? `No items matching "${query}"` : 'No intelligence yet. Ask Motu to research a topic above.'}</span></div>
      ) : filtered.map((item, idx) => (
        <div key={item.id} className={`glass-card anim-in-${Math.min(idx + 1, 4)}`} style={{ padding: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{item.title}</div>
                <span className="momentum">↑{item.relevance}%</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gh-text-2)', lineHeight: 1.6, marginBottom: 'var(--sp-3)' }}>{item.summary}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                {item.tags.map((tag, i) => <span key={tag} className={`tag ${TAG_COLORS[i % TAG_COLORS.length]}`}>{tag}</span>)}
                <span style={{ fontSize: 10, color: 'var(--gh-text-4)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{item.source} · {new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button className="btn btn-red" style={{ fontSize: 10, padding: '4px 8px', marginLeft: 'var(--sp-3)', flexShrink: 0 }} onClick={() => removeItem(item.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
