import { useState, useEffect } from 'react'
import { getClients, createClient, updateClient, deleteClient, type Client } from '../lib/api'
import { useSearch } from '../lib/SearchContext'

function ClientModal({ client, onClose, onSave }: {
  client?: Client | null; onClose: () => void
  onSave: (data: Partial<Client>) => void
}): React.JSX.Element {
  const [name, setName]       = useState(client?.name ?? '')
  const [email, setEmail]     = useState(client?.email ?? '')
  const [company, setCompany] = useState(client?.company ?? '')
  const [notes, setNotes]     = useState(client?.notes ?? '')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{client ? 'Edit Client' : 'New Client'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div><label className="form-label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name..." autoFocus /></div>
            <div><label className="form-label">Company</label><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name..." /></div>
          </div>
          <div><label className="form-label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" /></div>
          <div><label className="form-label">Notes</label><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this client..." /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => { if (!name.trim()) return; onSave({ name, email, company, notes }) }}>
              {client ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Clients(): React.JSX.Element {
  const [clients, setClients] = useState<Client[]>([])
  const [modal, setModal]     = useState<Client | null | undefined>(undefined)
  const { query }             = useSearch()

  function load() { getClients().then(setClients).catch(console.error) }
  useEffect(() => { load() }, [])

  async function handleSave(data: Partial<Client>) {
    if (modal?.id) await updateClient(modal.id, data)
    else await createClient(data)
    setModal(undefined); load()
  }

  async function handleDelete(id: number) { await deleteClient(id); load() }

  const filtered = clients.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.notes ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-subtitle">{filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}</div>
        </div>
        <button className="btn btn-orange" onClick={() => setModal(null)}>+ Add Client</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">◻</span>
          <span className="empty-text">{query ? `No clients matching "${query}"` : 'No clients yet. Add your first client.'}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
          {filtered.map((client, idx) => (
            <div key={client.id} className={`glass-card anim-in-${Math.min(idx + 1, 4)}`} style={{ padding: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--gh-blue), var(--gh-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#0d1117', boxShadow: '0 0 10px rgba(88,166,255,0.2)' }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{client.name}</div>
                    {client.company && <div style={{ fontSize: 11, color: 'var(--gh-blue)', marginTop: 1 }}>{client.company}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => setModal(client)}>Edit</button>
                  <button className="btn btn-red" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => handleDelete(client.id)}>✕</button>
                </div>
              </div>
              {client.email && <div style={{ fontSize: 11, color: 'var(--gh-text-3)', marginBottom: 'var(--sp-2)', fontFamily: 'var(--font-mono)' }}>✉ {client.email}</div>}
              {client.notes && <p style={{ fontSize: 11.5, color: 'var(--gh-text-2)', lineHeight: 1.5, marginBottom: 'var(--sp-2)' }}>{client.notes}</p>}
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>Added {new Date(client.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {modal !== undefined && <ClientModal client={modal} onClose={() => setModal(undefined)} onSave={handleSave} />}
    </div>
  )
}
