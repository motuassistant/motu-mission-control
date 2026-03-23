import { useState, useEffect } from 'react'
import { getUsage, getSettings, updateSettings, type ApiUsage, type UsageTotals, type ModelStat } from '../lib/api'

export default function ApiUsage(): React.JSX.Element {
  const [rows, setRows]           = useState<ApiUsage[]>([])
  const [totals, setTotals]       = useState<UsageTotals | null>(null)
  const [byModel, setByModel]     = useState<ModelStat[]>([])
  const [ollamaHost, setOllamaHost] = useState('')
  const [model, setModel]         = useState('')
  const [saved, setSaved]         = useState(false)

  function load() {
    getUsage().then(({ rows: r, totals: t, byModel: m }) => { setRows(r); setTotals(t); setByModel(m) }).catch(console.error)
    getSettings().then((s) => { setOllamaHost(s.ollama_host ?? ''); setModel(s.ollama_model ?? '') }).catch(console.error)
  }

  useEffect(() => { load() }, [])

  async function saveSettings() {
    await updateSettings({ ollama_host: ollamaHost, ollama_model: model })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
          { label: 'Total Calls',  value: totals?.total_calls ?? 0,  color: 'var(--gh-blue)',   mono: true },
          { label: 'Total Tokens', value: (totals?.total_tokens ?? 0).toLocaleString(), color: 'var(--gh-purple)', mono: true },
          { label: 'Est. Cost',    value: `$${(totals?.total_cost ?? 0).toFixed(4)}`,  color: 'var(--gh-teal)',   mono: true }
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
              const maxTokens = byModel[0]?.tokens ?? 1
              const pct = Math.round((m.tokens / maxTokens) * 100)
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

      {/* Settings */}
      <div className="glass-card anim-in-3" style={{ padding: 'var(--sp-5)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Ollama Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div>
            <label className="form-label">Ollama Host (beefy PC IP)</label>
            <input className="input" style={{ fontFamily: 'var(--font-mono)' }} value={ollamaHost} onChange={(e) => setOllamaHost(e.target.value)} placeholder="http://192.168.1.100:11434" />
          </div>
          <div>
            <label className="form-label">Model</label>
            <input className="input" style={{ fontFamily: 'var(--font-mono)' }} value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3" />
          </div>
        </div>
        <button className={`btn ${saved ? 'btn-teal' : 'btn-orange'}`} onClick={saveSettings}>
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
    </div>
  )
}
