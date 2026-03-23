import { useState } from 'react'
import { useSearch } from '../lib/SearchContext'

interface Doc {
  id: string; name: string; type: string; size: string; content: string; created_at: string
}

export default function Documents(): React.JSX.Element {
  const [docs, setDocs] = useState<Doc[]>(() => {
    try { return JSON.parse(localStorage.getItem('motu-docs') ?? '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Doc | null>(null)
  const [dragging, setDragging] = useState(false)
  const { query } = useSearch()

  function save(newDocs: Doc[]) { setDocs(newDocs); localStorage.setItem('motu-docs', JSON.stringify(newDocs)) }

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string ?? ''
        const doc: Doc = { id: Date.now() + '_' + file.name, name: file.name, type: file.type || 'text/plain', size: file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(1)} KB`, content: content.slice(0, 50000), created_at: new Date().toISOString() }
        setDocs((prev) => { const updated = [doc, ...prev]; localStorage.setItem('motu-docs', JSON.stringify(updated)); return updated })
      }
      reader.readAsText(file)
    })
  }

  function deleteDoc(id: string) { const updated = docs.filter((d) => d.id !== id); save(updated); if (selected?.id === id) setSelected(null) }

  const FILE_ICONS: Record<string, string> = { 'text/plain': '📄', 'text/markdown': '📝', 'application/pdf': '📕', 'application/json': '{}', 'text/csv': '📊', 'default': '📁' }

  const filteredDocs = docs.filter((d) => {
    if (!query) return true
    const q = query.toLowerCase()
    return d.name.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
  })

  return (
    <div className="page" style={{ padding: 0, display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--gh-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(13,17,23,0.3)' }}>
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--gh-border)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Documents</div>
          <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginBottom: 'var(--sp-3)' }}>
            {filteredDocs.length}{query ? ` of ${docs.length}` : ''} file{filteredDocs.length !== 1 ? 's' : ''}{query ? ` · "${query}"` : ''}
          </div>
          <label style={{ display: 'block' }}>
            <input type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
            <div className="btn btn-orange" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>+ Upload Files</div>
          </label>
        </div>
        <div style={{ margin: 'var(--sp-3)', border: `2px dashed ${dragging ? 'var(--gh-blue)' : 'var(--gh-border)'}`, borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', textAlign: 'center', fontSize: 11, color: dragging ? 'var(--gh-blue)' : 'var(--gh-text-4)', transition: 'all var(--t-fast) var(--ease)', background: dragging ? 'var(--blue-soft)' : 'transparent' }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}>
          Drop files here
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-2)' }}>
          {filteredDocs.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--sp-6) var(--sp-4)' }}><span className="empty-icon">❑</span><span className="empty-text">{query ? `No files matching "${query}"` : 'No documents yet'}</span></div>
          ) : filteredDocs.map((doc) => (
            <div key={doc.id} onClick={() => setSelected(doc)}
              style={{ padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', cursor: 'pointer', marginBottom: 'var(--sp-1)', background: selected?.id === doc.id ? 'var(--blue-soft)' : 'transparent', border: `1px solid ${selected?.id === doc.id ? 'var(--blue-border)' : 'transparent'}`, transition: 'all var(--t-fast) var(--ease)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
              onMouseEnter={(e) => { if (selected?.id !== doc.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { if (selected?.id !== doc.id) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{FILE_ICONS[doc.type] ?? FILE_ICONS.default}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: selected?.id === doc.id ? 'var(--gh-blue)' : 'var(--gh-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                <div style={{ fontSize: 10, color: 'var(--gh-text-4)' }}>{doc.size}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--gh-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{selected.size} · Added {new Date(selected.created_at).toLocaleDateString()}</div>
              </div>
              <button className="btn btn-red" style={{ fontSize: 11 }} onClick={() => deleteDoc(selected.id)}>Delete</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)' }}>
              <pre style={{ fontSize: 12, color: 'var(--gh-text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: selected.type === 'application/json' ? 'var(--font-mono)' : 'var(--font)' }}>
                {selected.content}
              </pre>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}><span className="empty-icon">❑</span><span className="empty-text">Upload documents to give Motu context. Select a document to view its contents.</span></div>
        )}
      </div>
    </div>
  )
}
