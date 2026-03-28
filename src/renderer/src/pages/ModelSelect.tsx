import { useState, useEffect } from 'react'
import { getOllamaModels } from '../lib/api'

interface ModelSelectProps {
  value: string
  onChange: (model: string) => void
  placeholder?: string
}

export default function ModelSelect({ value, onChange, placeholder = 'Select a model...' }: ModelSelectProps): React.JSX.Element {
  const [models, setModels]   = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    getOllamaModels()
      .then(({ models: m, error: e }) => {
        if (e || m.length === 0) {
          setError(true)
        } else {
          setModels(m)
          // Auto-select first model if current value isn't in the list.
          // Handles mismatches like "llama3" vs "llama3:latest" and the
          // single-model case where the select would otherwise show blank.
          if (!value || !m.includes(value)) {
            onChange(m[0])
          }
        }
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="input" style={{ color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ animation: 'pulse 1s infinite' }}>○</span> Fetching models...
      </div>
    )
  }

  if (error || models.length === 0) {
    return (
      <div>
        <input
          className="input"
          style={{ fontFamily: 'var(--font-mono)' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter model name (e.g. llama3)"
        />
        <div style={{ fontSize: 10, color: 'var(--gh-yellow)', marginTop: 'var(--sp-1)' }}>
          ⚠ Could not fetch models from Ollama — enter model name manually
        </div>
      </div>
    )
  }

  return (
    <select
      className="select"
      style={{ fontFamily: 'var(--font-mono)' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!value && <option value="" disabled>{placeholder}</option>}
      {models.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  )
}
