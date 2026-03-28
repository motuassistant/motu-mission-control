import { useState, useEffect } from 'react'
import { getUsage, getOllamaModels, clearDb, updateAgent, type ApiUsage, type UsageTotals, type ModelStat } from '../lib/api'
import { useSettings } from '../lib/SettingsContext'

export default function ApiUsage(): React.JSX.Element {
  const { settings, loaded, saveSettings } = useSettings()

  const [rows, setRows]             = useState<ApiUsage[]>([])
  const [totals, setTotals]         = useState<UsageTotals | null>(null)
  const [byModel, setByModel]       = useState<ModelStat[]>([])
  const [ollamaHost, setOllamaHost] = useState('')
  const [model, setModel]           = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading]     = useState(false)
  const [modelsError, setModelsError]         = useState('')
  const [saved, setSaved]           = useState(false)
  const [clearing, setClearing]     = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  // Populate local form state from context once loaded
  useEffect(() => {
    if (loaded) {
      setOllamaHost(settings.ollama_host ?? '')
      setModel(settings.ollama_model ?? '')
    }
  }, [loaded, settings.ollama_host, settings.ollama_model])

  function loadUsage() {
    getUsage().then(({ rows: r, totals: t, byModel: m }) => {
      setRows(r); setTotals(t); setByModel(m)
    }).catch(console.error)
  }

  useEffect(() => { loadUsage() }, [])

  async function fetchModels() {
    setModelsLoading(true)
    setModelsError('')
    try {
      const { models: m, error: e } = await getOllamaModels()
      if (e || m.length === 0) {
        setModelsError('Could not reach Ollama — is your beefy PC on?')
        setAvailableModels([])
      } else {
        setAvailableModels(m)
        // If current model value isn't in the fetched list, auto-select first.
        if (!model || !m.includes(model)) {
          setModel(m[0])
        }
      }
    } catch {
      setModelsError('Could not reach Ollama — is your beefy PC on?')
    } finally {
      setModelsLoading(false)
    }
  }

  // Auto-fetch models when host changes
  useEffect(() => {
    if (!ollamaHost) return
    const t = setTimeout(fetchModels, 800)
    return () => clearTimeout(t)
  }, [ollamaHost])

  async function handleSave() {
    await saveSettings({ ollama_host: ollamaHost, ollama_model: model })
    // Also update Motu's model so he uses the new global default
    await updateAgent(1, { model })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClearDb() {
    if (!clearConfirm) { setClearConfirm(true); return }
    setClearing(true)
    try {
      await clearDb()
      setClearConfirm(false)
      loadUsage()
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="page-header">
        <div>
          <div className="page-title">API Usage</div>
          <div className="page-subtitle">Ollama token usage and connection settings</div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-4)' }}>
        {[
          { label: 'Total Calls',  value: totals?.total_calls ?? 0,                    color: 'var(--gh-blue)'   },
          { label: 'Total Tokens', value: (totals?.total_tokens ?? 0).toLocaleString(), color: 'var(--gh-purple)' },
          { label: 'Est. Cost',    value: `$${(totals?.total_cost ?? 0).toFixed(4)}`,   color: 'var(--gh-teal)'   }
        ].map((s) => (
          <div key={s.label} className="glass-card anim-in" style={{ padding: 'var(--sp-5)' }}>
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color, lineHeight: 1, letterSpacing: '-0.04em', textShadow: `0 0 12px ${s.color}40` }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* By model */}
      {byModel.length > 0 && (
        <div className="glass-card anim-in-2" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Usage by Model</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {byModel.map((m) => {
              const pct = Math.round((m.tokens / (byModel[0]?.tokens ?? 1)) * 100)
              return (
                <div key={m.model}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--gh-text-1)' }}>{m.model}</span>
                    <span style={{ fontSize: 11, color: 'var(--gh-text-3)', fontFamily: 'var(--font-mono)' }}>{m.tokens.toLocaleString()} tokens · {m.calls} calls</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ollama Settings */}
      <div className="glass-card anim-in-3" style={{ padding: 'var(--sp-5)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Ollama Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>

          <div>
            <label className="form-label">Ollama Host (beefy PC IP)</label>
            <input
              className="input"
              style={{ fontFamily: 'var(--font-mono)' }}
              value={ollamaHost}
              onChange={(e) => setOllamaHost(e.target.value)}
              placeholder="http://192.168.1.100:11434"
            />
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 'var(--sp-1)' }}>
              Save first if you changed the host, then models will refresh
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
              <label className="form-label" style={{ margin: 0 }}>Global Model</label>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '3px 8px' }}
                onClick={fetchModels}
                disabled={modelsLoading}
              >
                {modelsLoading ? 'Loading...' : '⟳ Refresh'}
              </button>
            </div>
            {availableModels.length > 0 ? (
              <select className="select" style={{ fontFamily: 'var(--font-mono)' }} value={model} onChange={(e) => setModel(e.target.value)}>
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                className="input"
                style={{ fontFamily: 'var(--font-mono)' }}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="llama3"
              />
            )}

            {modelsError && (
              <div style={{ fontSize: 10, color: 'var(--gh-orange)', marginTop: 'var(--sp-1)' }}>
                {modelsError} — enter model name manually above.
              </div>
            )}
            {availableModels.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 'var(--sp-1)' }}>
                {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available · also updates Motu's model
              </div>
            )}
          </div>
        </div>
        <button className={`btn ${saved ? 'btn-teal' : 'btn-orange'}`} onClick={handleSave} disabled={!loaded}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      {/* Recent calls */}
      {rows.length > 0 && (
        <div className="glass-card anim-in-4" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Recent API Calls</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--gh-border)' }}>
                  {['Model', 'Prompt', 'Completion', 'Total', 'Cost', 'Time'].map((h) => (
                    <th key={h} style={{ padding: 'var(--sp-2) var(--sp-3)', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gh-text-4)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--gh-border-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', fontFamily: 'var(--font-mono)', color: 'var(--gh-blue)' }}>{row.model}</td>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', fontFamily: 'var(--font-mono)', color: 'var(--gh-text-2)' }}>{row.prompt_tokens.toLocaleString()}</td>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', fontFamily: 'var(--font-mono)', color: 'var(--gh-text-2)' }}>{row.completion_tokens.toLocaleString()}</td>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', fontFamily: 'var(--font-mono)', color: 'var(--gh-text-1)', fontWeight: 600 }}>{row.total_tokens.toLocaleString()}</td>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', fontFamily: 'var(--font-mono)', color: 'var(--gh-teal)' }}>${row.estimated_cost.toFixed(4)}</td>
                    <td style={{ padding: 'var(--sp-2) var(--sp-3)', color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{new Date(row.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && totals?.total_calls === 0 && (
        <div className="empty-state"><span className="empty-icon">▲</span><span className="empty-text">No API calls yet. Chat with Motu in The Hub to see usage here.</span></div>
      )}

      {/* Dev Tools */}
      <div className="glass-card" style={{ padding: 'var(--sp-5)', borderColor: 'var(--orange-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Developer Tools</div>
            <div style={{ fontSize: 11, color: 'var(--gh-text-3)', lineHeight: 1.6 }}>
              Clears all tasks, events, commits, messages, journal entries, cron jobs, and API usage logs.
              Keeps your settings and the Motu commander agent.{' '}
              <span style={{ color: 'var(--gh-orange)', fontWeight: 600 }}>This cannot be undone.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0, alignItems: 'center' }}>
            {clearConfirm && (
              <button className="btn btn-ghost" onClick={() => setClearConfirm(false)}>
                Cancel
              </button>
            )}
            <button
              className="btn btn-red"
              onClick={handleClearDb}
              disabled={clearing}
              style={{ minWidth: 130 }}
            >
              {clearing ? 'Clearing...' : clearConfirm ? '⚠ Confirm Clear' : 'Clear Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
