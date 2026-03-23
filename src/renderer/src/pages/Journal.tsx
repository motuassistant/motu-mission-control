import { useState, useEffect } from 'react'
import { getJournal, createJournalEntry, updateJournalEntry, deleteJournalEntry, type JournalEntry } from '../lib/api'
import { useSearch } from '../lib/SearchContext'

function JournalModal({ entry, onClose, onSave }: {
  entry?: JournalEntry | null; onClose: () => void
  onSave: (data: { title: string; content: string }) => void
}): React.JSX.Element {
  const [title, setTitle]     = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div className="modal-title">{entry ? 'Edit Entry' : 'New Journal Entry'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div><label className="form-label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title..." autoFocus /></div>
          <div><label className="form-label">Content</label><textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your thoughts..." style={{ minHeight: 200 }} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => { if (!title.trim() || !content.trim()) return; onSave({ title, content }) }}>
              {entry ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Journal(): React.JSX.Element {
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [modal, setModal]       = useState<JournalEntry | null | undefined>(undefined)
  const [selected, setSelected] = useState<JournalEntry | null>(null)
  const { query }               = useSearch()

  function load() { getJournal().then(setEntries).catch(console.error) }
  useEffect(() => { load() }, [])

  async function handleSave(data: { title: string; content: string }) {
    if (modal?.id) await updateJournalEntry(modal.id, data)
    else await createJournalEntry(data)
    setModal(undefined); load()
  }

  async function handleDelete(id: number) {
    await deleteJournalEntry(id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const filtered = entries.filter((e) => {
    if (!query) return true
    const q = query.toLowerCase()
    return e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
  })

  return (
    <div className="page" style={{ padding: 0, display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Sidebar list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--gh-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(13,17,23,0.3)' }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Journal</div>
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 1 }}>
              {filtered.length}{query ? ` of ${entries.length}` : ''} {filtered.length !== 1 ? 'entries' : 'entry'}
              {query ? ` · "${query}"` : ''}
            </div>
          </div>
          <button className="btn btn-orange" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setModal(null)}>+ New</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-6) var(--sp-4)' }}>
              <span className="empty-icon">◎</span>
              <span className="empty-text">{query ? `No entries matching "${query}"` : 'No entries yet'}</span>
            </div>
          ) : filtered.map((entry) => (
            <div key={entry.id}
              onClick={() => setSelected(entry)}
              style={{ padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 'var(--sp-1)', background: selected?.id === entry.id ? 'var(--blue-soft)' : 'transparent', border: `1px solid ${selected?.id === entry.id ? 'var(--blue-border)' : 'transparent'}`, transition: 'all var(--t-fast) var(--ease)' }}
              onMouseEnter={(e) => { if (selected?.id !== entry.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (selected?.id !== entry.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: selected?.id === entry.id ? 'var(--gh-blue)' : 'var(--gh-text-1)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content pane */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(selected.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setModal(selected)}>Edit</button>
                <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => handleDelete(selected.id)}>Delete</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)' }}>
              <p style={{ fontSize: 13, color: 'var(--gh-text-1)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content}</p>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}>
            <span className="empty-icon">◎</span>
            <span className="empty-text">Select an entry to read it, or create a new one.</span>
          </div>
        )}
      </div>

      {modal !== undefined && <JournalModal entry={modal} onClose={() => setModal(undefined)} onSave={handleSave} />}
    </div>
  )
}
