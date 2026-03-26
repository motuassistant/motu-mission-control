import { useState, useEffect } from 'react'
import { getAgents, createAgent, updateAgent, deleteAgent, type Agent } from '../lib/api'
import { useSearch } from '../lib/SearchContext'
import { useSettings } from '../lib/SettingsContext'
import ModelSelect from './ModelSelect'

const AVATAR_OPTIONS = ['🤖', '🧠', '⚡', '🔬', '🛠️', '📊', '🎯', '🔮', '🌐', '🚀']
const COLOR_OPTIONS  = ['#58a6ff', '#39d353', '#f78166', '#bc8cff', '#e3b341', '#ff7eb3']

// Full edit modal for non-commander agents
function AgentModal({ agent, defaultModel, onClose, onSave }: {
  agent?: Agent | null
  defaultModel: string
  onClose: () => void
  onSave: (data: Partial<Agent>) => void
}): React.JSX.Element {
  const [name, setName]     = useState(agent?.name ?? '')
  const [role, setRole]     = useState(agent?.role ?? '')
  const [desc, setDesc]     = useState(agent?.description ?? '')
  const [avatar, setAvatar] = useState(agent?.avatar ?? '🤖')
  const [color, setColor]   = useState(agent?.color ?? '#58a6ff')
  const [model, setModel]   = useState(agent?.model ?? defaultModel)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{agent ? 'Edit Agent' : 'New Agent'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div>
              <label className="form-label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name..." autoFocus />
            </div>
            <div>
              <label className="form-label">Role</label>
              <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Architect, Analyst..." />
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this agent do? This is used as their system prompt in The Hub." />
          </div>
          <div>
            <label className="form-label">Model</label>
            <ModelSelect
              value={model}
              onChange={setModel}
              placeholder={`Default (${defaultModel})`}
            />
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 'var(--sp-1)' }}>
              Override the global model for this agent specifically
            </div>
          </div>
          <div>
            <label className="form-label">Avatar</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {AVATAR_OPTIONS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)} style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', border: `2px solid ${avatar === a ? 'var(--gh-blue)' : 'var(--gh-border)'}`, background: avatar === a ? 'var(--blue-soft)' : 'var(--gh-elevated)', fontSize: 18, cursor: 'pointer', transition: 'all var(--t-fast) var(--ease)' }}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              {COLOR_OPTIONS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `2px solid ${color === c ? 'white' : 'transparent'}`, cursor: 'pointer', boxShadow: color === c ? `0 0 8px ${c}` : 'none', transition: 'all var(--t-fast) var(--ease)' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => {
              if (!name.trim() || !role.trim()) return
              onSave({ name, role, description: desc, avatar, color, model: model || defaultModel })
            }}>
              {agent ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Minimal modal for Motu — model only, no other fields editable
function MotuModelModal({ agent, defaultModel, onClose, onSave }: {
  agent: Agent; defaultModel: string; onClose: () => void
  onSave: (data: Partial<Agent>) => void
}): React.JSX.Element {
  const [model, setModel] = useState(agent.model ?? defaultModel)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Motu · Model Settings</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">
            Motu is the commander and cannot be fully edited. You can set his Ollama model here,
            or update the global default in API Usage which will also update Motu.
          </div>
          <div>
            <label className="form-label">Ollama Model</label>
            <ModelSelect value={model} onChange={setModel} placeholder={`Default (${defaultModel})`} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => onSave({ model: model || defaultModel })}>
              Save Model
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Agents(): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([])
  const [modal, setModal]   = useState<Agent | null | undefined>(undefined)
  const [motuModal, setMotuModal] = useState(false)
  const { query }           = useSearch()
  const { settings }        = useSettings()

  const defaultModel = settings.ollama_model ?? 'llama3'

  function load() { getAgents().then(setAgents).catch(console.error) }
  useEffect(() => { load() }, [])

  async function handleSave(data: Partial<Agent>) {
    if (modal?.id) await updateAgent(modal.id, data)
    else await createAgent(data)
    setModal(undefined); load()
  }

  async function handleMotuModelSave(data: Partial<Agent>) {
    await updateAgent(1, data)
    setMotuModal(false); load()
  }

  async function handleDelete(id: number) { await deleteAgent(id); load() }

  const filtered = agents.filter((a) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q)
    )
  })

  const motuAgent = agents.find((a) => a.is_commander)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Agents</div>
          <div className="page-subtitle">
            {filtered.length} agent{filtered.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}
          </div>
        </div>
        <button className="btn btn-orange" onClick={() => setModal(null)}>+ New Agent</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
        {filtered.map((agent, idx) => (
          <div key={agent.id} className={`glass-card anim-in-${Math.min(idx + 1, 4)}`} style={{ padding: 'var(--sp-5)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 'var(--r-lg)', background: `linear-gradient(135deg, ${agent.color}22, ${agent.color}08)`, border: `1px solid ${agent.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 0 12px ${agent.color}22` }}>
                  {agent.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: agent.color, fontWeight: 600, marginTop: 2 }}>{agent.role}</div>
                </div>
              </div>
              {agent.is_commander ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span className="badge badge-active" style={{ flexShrink: 0 }}>Commander</span>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => setMotuModal(true)}>Model</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => setModal(agent)}>Edit</button>
                  <button className="btn btn-red" style={{ padding: '4px 8px', fontSize: 10 }} onClick={() => handleDelete(agent.id)}>✕</button>
                </div>
              )}
            </div>

            {agent.description && (
              <p style={{ fontSize: 11.5, color: 'var(--gh-text-2)', lineHeight: 1.5, marginBottom: 'var(--sp-3)' }}>
                {agent.description}
              </p>
            )}

            {/* Model badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--sp-2)' }}>
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>
                Added {new Date(agent.created_at).toLocaleDateString()}
              </div>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--gh-purple)', background: 'var(--purple-soft)', border: '1px solid var(--purple-border)', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>
                {agent.model ?? defaultModel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">◉</span>
          <span className="empty-text">
            {query ? `No agents matching "${query}"` : 'Only Motu exists. Add sub-agents to expand capabilities.'}
          </span>
        </div>
      )}

      {modal !== undefined && (
        <AgentModal
          agent={modal}
          defaultModel={defaultModel}
          onClose={() => setModal(undefined)}
          onSave={handleSave}
        />
      )}

      {motuModal && motuAgent && (
        <MotuModelModal agent={motuAgent} defaultModel={defaultModel} onClose={() => setMotuModal(false)} onSave={handleMotuModelSave} />
      )}
    </div>
  )
}
