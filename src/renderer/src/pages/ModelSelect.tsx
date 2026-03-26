import { useState, useEffect } from 'react'
import { getOllamaModels } from '../lib/api'

interface ModelSelectProps {
  value: string
  onChange: (model: string) => void
  placeholder?: string
  fallbackLabel?: string // shown when models can't be fetched
}

export default function ModelSelect({
  value,
  onChange,
  placeholder = 'Select a model...',
  fallbackLabel
}: ModelSelectProps): React.JSX.Element {
  const [models, setModels]     = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  useEffect(() => {
    getOllamaModels()
      .then(({ models: m, error: e }) => {
        if (e || m.length === 0) {
          setError(true)
        } else {
          setModels(m)
          // If current value isn't in the list, don't override it —
          // user may have typed a valid model we just can't reach right now
        }
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  // If we couldn't fetch models, fall back to a plain text input
  if (error || (models.length === 0 && !loading)) {
    return (
      <div>
        <input
          className="input"
          style={{ fontFamily: 'var(--font-mono)' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallbackLabel ?? placeholder}
        />
        <div style={{ fontSize: 10, color: 'var(--gh-yellow)', marginTop: 'var(--sp-1)' }}>
          ⚠ Could not fetch models from Ollama — enter model name manually
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="input" style={{ color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ animation: 'pulse 1s infinite' }}>○</span> Fetching models...
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
      {placeholder && !value && (
        <option value="" disabled>{placeholder}</option>
      )}
      {/* If current value isn't in list (was typed manually), show it too */}
      {value && !models.includes(value) && (
        <option value={value}>{value} (custom)</option>
      )}
      {models.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  )
}
