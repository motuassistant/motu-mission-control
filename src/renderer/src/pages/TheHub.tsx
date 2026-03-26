import { useState, useEffect, useRef } from 'react'
import { getHubMessages, createHubMessage, getAgents, chat, type AgentMessage, type Agent } from '../lib/api'
import { useSearch } from '../lib/SearchContext'
import { useSettings } from '../lib/SettingsContext'

function timeAgo(d: string): string {
  const date = new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z')
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

export default function TheHub(): React.JSX.Element {
  const [messages, setMessages]     = useState<AgentMessage[]>([])
  const [agents, setAgents]         = useState<Agent[]>([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('Motu')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { query } = useSearch()
  const { settings, loaded }              = useSettings()

  // Derived from settings — never use defaults before settings load
  const ollamaHost = settings.ollama_host ?? 'http://localhost:11434'
  const globalModel = settings.ollama_model ?? 'llama3'

  function load() {
    getHubMessages().then(setMessages).catch(console.error)
    getAgents().then(setAgents).catch(console.error)
  }

  useEffect(() => {
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if (!query) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, query])

  async function sendMessage() {
    if (!input.trim() || sending || !loaded) return
    setSending(true)
    const userMsg = input.trim()
    setInput('')

    await createHubMessage({ from_agent: 'You', to_agent: selectedAgent, message: userMsg }).catch(console.error)
    load()

    try {
      // Get the selected agent's data for system prompt + model
      const agentData = agents.find((a) => a.name === selectedAgent)
      const agentModel = agentData?.model ?? globalModel

      // Build system prompt so Ollama actually knows who it's playing
      const systemPrompt = {
        role: 'system' as const,
        content: `You are ${agentData?.name ?? selectedAgent}, an AI agent in a system called Motu Mission Control. Your role is: ${agentData?.role ?? 'assistant'}. ${agentData?.description ? `About you: ${agentData.description}` : ''} Stay in character. Be concise and helpful.`
      }

      // Only include messages relevant to this agent conversation
      const history = messages
        .filter((m) =>
          (m.from_agent === 'You' && m.to_agent === selectedAgent) ||
          (m.from_agent === selectedAgent && m.to_agent === 'You')
        )
        .slice(-10)
        .map((m) => ({
          role: m.from_agent === 'You' ? 'user' as const : 'assistant' as const,
          content: m.message
        }))

      const response = await chat([systemPrompt, ...history, { role: 'user', content: userMsg }], agentModel, ollamaHost)

      if (response.message?.content) {
        await createHubMessage({ from_agent: selectedAgent, to_agent: 'You', message: response.message.content })
        load()
      } else if (response.error) {
        await createHubMessage({ from_agent: 'System', to_agent: 'You', message: `⚠️ ${response.error}` })
        load()
      }
    } catch {
      await createHubMessage({ from_agent: 'System', to_agent: 'You', message: '⚠️ Could not reach Ollama. Make sure your beefy PC is running.' })
      load()
    } finally {
      setSending(false)
    }
  }

  const agentColors: Record<string, string> = {}
  agents.forEach((a) => { agentColors[a.name] = a.color })

  const selectedAgentData = agents.find((a) => a.name === selectedAgent)
  const activeModel = selectedAgentData?.model ?? globalModel

  const visibleMessages = messages.filter((m) => {
    // Always show system messages
    if (m.from_agent === 'System') return true
    // Only show messages between You and the selected agent
    return (
      (m.from_agent === 'You' && m.to_agent === selectedAgent) ||
      (m.from_agent === selectedAgent && m.to_agent === 'You')
    )
  })

  const filteredMessages = query
    ? visibleMessages.filter((m) =>
        m.message.toLowerCase().includes(query.toLowerCase()) ||
        m.from_agent.toLowerCase().includes(query.toLowerCase())
      )
    : visibleMessages

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-4)', borderBottom: '1px solid var(--gh-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>The Hub</div>
            <div style={{ fontSize: 11, color: 'var(--gh-text-4)', marginTop: 2 }}>
              {query ? `${filteredMessages.length} messages matching "${query}"` : 'Agent communication channel'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            {/* Agent selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 11, color: 'var(--gh-text-3)' }}>
              <span>Talk to:</span>
              <select className="select" style={{ width: 'auto', padding: '4px 28px 4px 10px' }} value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
                {agents.map((a) => <option key={a.id} value={a.name}>{a.avatar} {a.name}</option>)}
              </select>
            </div>

            {/* Shows which model this agent uses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--gh-purple)', background: 'var(--purple-soft)', border: '1px solid var(--purple-border)', borderRadius: 'var(--r-full)', padding: '3px 10px', fontFamily: 'var(--font-mono)' }}>
              {activeModel}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--gh-teal)', fontWeight: 600 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gh-teal)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              {loaded ? 'Connected' : 'Loading...'}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {filteredMessages.length === 0 ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <span className="empty-icon">💬</span>
            <span className="empty-text">
              {query ? `No messages matching "${query}"` : `No messages yet. Start a conversation with ${selectedAgent} below.`}
            </span>
          </div>
        ) : filteredMessages.map((msg) => {
          const isUser   = msg.from_agent === 'You'
          const isSystem = msg.from_agent === 'System'
          const agentColor = agentColors[msg.from_agent] ?? 'var(--gh-blue)'

          if (isSystem) {
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: 'var(--yellow-soft)', border: '1px solid var(--yellow-border)', borderRadius: 'var(--r-full)', padding: '4px 14px', fontSize: 11, color: 'var(--gh-yellow)' }}>
                  {msg.message}
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} style={{ display: 'flex', gap: 'var(--sp-3)', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', flexShrink: 0, background: isUser ? 'var(--gh-elevated)' : `linear-gradient(135deg, ${agentColor}33, ${agentColor}11)`, border: `1px solid ${isUser ? 'var(--gh-border)' : agentColor + '44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: isUser ? 'none' : `0 0 10px ${agentColor}22` }}>
                {isUser ? '👤' : agents.find((a) => a.name === msg.from_agent)?.avatar ?? '🤖'}
              </div>
              <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isUser ? 'var(--gh-text-3)' : agentColor }}>{msg.from_agent}</span>
                  {msg.to_agent && <span style={{ fontSize: 9, color: 'var(--gh-text-4)' }}>→ {msg.to_agent}</span>}
                  <span style={{ fontSize: 9, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>{timeAgo(msg.created_at)}</span>
                </div>
                <div style={{ background: isUser ? 'rgba(88,166,255,0.08)' : 'rgba(22,27,34,0.8)', border: `1px solid ${isUser ? 'var(--blue-border)' : 'var(--gh-border)'}`, borderRadius: isUser ? 'var(--r-lg) var(--r-sm) var(--r-lg) var(--r-lg)' : 'var(--r-sm) var(--r-lg) var(--r-lg) var(--r-lg)', padding: 'var(--sp-3) var(--sp-4)', fontSize: 12.5, color: 'var(--gh-text-1)', lineHeight: 1.6, backdropFilter: 'blur(8px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.message}
                </div>
              </div>
            </div>
          )
        })}

        {sending && (
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
            <div style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: `linear-gradient(135deg, ${agentColors[selectedAgent] ?? 'rgba(88,166,255,0.2)'}, rgba(88,166,255,0.05))`, border: '1px solid var(--blue-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {selectedAgentData?.avatar ?? '🤖'}
            </div>
            <div style={{ background: 'rgba(22,27,34,0.8)', border: '1px solid var(--gh-border)', borderRadius: 'var(--r-sm) var(--r-lg) var(--r-lg) var(--r-lg)', padding: 'var(--sp-3) var(--sp-4)', fontSize: 12.5, color: 'var(--gh-text-3)', backdropFilter: 'blur(8px)' }}>
              <span style={{ animation: 'pulse 1s infinite' }}>{selectedAgent} is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!query && (
        <div style={{ padding: 'var(--sp-4) var(--sp-6)', borderTop: '1px solid var(--gh-border)', flexShrink: 0, background: 'rgba(13,17,23,0.3)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end' }}>
            <textarea
              className="textarea"
              style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', lineHeight: 1.5 }}
              placeholder={loaded ? `Message ${selectedAgent}...` : 'Loading settings...'}
              value={input}
              disabled={!loaded}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            />
            <button className="btn btn-orange" style={{ height: 44, paddingLeft: 'var(--sp-5)', paddingRight: 'var(--sp-5)' }} onClick={sendMessage} disabled={sending || !input.trim() || !loaded}>
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--gh-text-4)', marginTop: 'var(--sp-2)' }}>
            Enter to send · Shift+Enter for new line · {selectedAgent} using {activeModel} on {ollamaHost}
          </div>
        </div>
      )}
    </div>
  )
}
