const BASE = 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ── Agents ────────────────────────────────────────────────
export const getAgents = () => request<Agent[]>('/api/agents')
export const createAgent = (data: Partial<Agent>) =>
  request<{ id: number }>('/api/agents', { method: 'POST', body: JSON.stringify(data) })
export const updateAgent = (id: number, data: Partial<Agent>) =>
  request('/api/agents/' + id, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteAgent = (id: number) =>
  request('/api/agents/' + id, { method: 'DELETE' })

// ── Status ────────────────────────────────────────────────
export const getStatus = () => request<AgentStatus>('/api/status')
export const updateStatus = (data: Partial<AgentStatus>) =>
  request('/api/status', { method: 'PATCH', body: JSON.stringify(data) })

// ── Tasks ─────────────────────────────────────────────────
export const getTasks = () =>
  request<Task[]>('/api/tasks').then((t) => t.map(parseTask))

export const getTasksByStatus = (status: string) =>
  request<Task[]>(`/api/tasks/status/${status}`).then((t) => t.map(parseTask))

export const createTask = (data: Partial<Task>) =>
  request<{ id: number }>('/api/tasks', { method: 'POST', body: JSON.stringify(data) })

export const updateTask = (id: number, data: Partial<Task>) =>
  request('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteTask = (id: number) =>
  request('/api/tasks/' + id, { method: 'DELETE' })

export const addTaskLog = (id: number, data: { text: string; type?: string }) =>
  request(`/api/tasks/${id}/log`, { method: 'POST', body: JSON.stringify(data) })

function parseTask(t: any): Task {
  return {
    ...t,
    tags: Array.isArray(t.tags) ? t.tags : JSON.parse(t.tags || '[]'),
    activity_log: Array.isArray(t.activity_log)
      ? t.activity_log
      : JSON.parse(t.activity_log || '[]')
  }
}

// ── Commits ───────────────────────────────────────────────
export const getCommits = () => request<Commit[]>('/api/commits')
export const createCommit = (data: { message: string; author?: string }) =>
  request<{ id: number }>('/api/commits', { method: 'POST', body: JSON.stringify(data) })

// ── Events ────────────────────────────────────────────────
export const getEvents = () => request<SystemEvent[]>('/api/events')
export const createEvent = (data: { type: string; text: string }) =>
  request<{ id: number }>('/api/events', { method: 'POST', body: JSON.stringify(data) })

// ── Cron Jobs ─────────────────────────────────────────────
export const getCronJobs = () => request<CronJob[]>('/api/cron-jobs')
export const createCronJob = (data: Partial<CronJob>) =>
  request<{ id: number }>('/api/cron-jobs', { method: 'POST', body: JSON.stringify(data) })
export const updateCronJob = (id: number, data: Partial<CronJob>) =>
  request('/api/cron-jobs/' + id, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteCronJob = (id: number) =>
  request('/api/cron-jobs/' + id, { method: 'DELETE' })

// ── Hub ───────────────────────────────────────────────────
export const getHubMessages = () => request<AgentMessage[]>('/api/hub')
export const createHubMessage = (data: { from_agent: string; to_agent?: string; message: string }) =>
  request<{ id: number }>('/api/hub', { method: 'POST', body: JSON.stringify(data) })

// ── API Usage ─────────────────────────────────────────────
export const getUsage = () =>
  request<{ rows: ApiUsage[]; totals: UsageTotals; byModel: ModelStat[] }>('/api/usage')

// ── Journal ───────────────────────────────────────────────
export const getJournal = () => request<JournalEntry[]>('/api/journal')
export const createJournalEntry = (data: { title: string; content: string }) =>
  request<{ id: number }>('/api/journal', { method: 'POST', body: JSON.stringify(data) })
export const updateJournalEntry = (id: number, data: { title?: string; content?: string }) =>
  request('/api/journal/' + id, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteJournalEntry = (id: number) =>
  request('/api/journal/' + id, { method: 'DELETE' })

// ── Clients ───────────────────────────────────────────────
export const getClients = () => request<Client[]>('/api/clients')
export const createClient = (data: Partial<Client>) =>
  request<{ id: number }>('/api/clients', { method: 'POST', body: JSON.stringify(data) })
export const updateClient = (id: number, data: Partial<Client>) =>
  request('/api/clients/' + id, { method: 'PATCH', body: JSON.stringify(data) })
export const deleteClient = (id: number) =>
  request('/api/clients/' + id, { method: 'DELETE' })

// ── Settings ──────────────────────────────────────────────
export const getSettings = () => request<Record<string, string>>('/api/settings')
export const updateSettings = (data: Record<string, string>) =>
  request('/api/settings', { method: 'PATCH', body: JSON.stringify(data) })

// ── Chat ──────────────────────────────────────────────────
export const chat = (messages: ChatMessage[], model?: string, ollamaHost?: string) =>
  request<OllamaResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, model, ollamaHost })
  })

// ── Types ─────────────────────────────────────────────────
export interface Agent {
  id: number; name: string; role: string; description: string
  avatar: string; color: string; is_commander: number; created_at: string
}

export interface AgentStatus {
  id: number; status: 'idle' | 'active' | 'busy'
  current_activity: string; bandwidth: number; last_active: string
}

export interface TaskLogEntry {
  text: string; type: 'info' | 'success' | 'warn' | 'error'; created_at: string
}

export interface Task {
  id: number; title: string; description: string
  status: 'queued' | 'active' | 'completed'
  assigned_to: number; agent_name?: string; agent_avatar?: string; agent_color?: string
  momentum: number; tags: string[]; activity_log: TaskLogEntry[]
  started_at: string | null; completed_at: string | null
  created_at: string; updated_at: string
}

export interface Commit {
  id: number; message: string; author: string; created_at: string
}

export interface SystemEvent {
  id: number; type: 'info' | 'success' | 'warn' | 'error'; text: string; created_at: string
}

export interface CronJob {
  id: number; name: string; schedule: string; description: string
  enabled: number; last_run: string | null; next_run: string | null; created_at: string
}

export interface AgentMessage {
  id: number; from_agent: string; to_agent: string | null; message: string; created_at: string
}

export interface ApiUsage {
  id: number; model: string; prompt_tokens: number; completion_tokens: number
  total_tokens: number; estimated_cost: number; created_at: string
}

export interface UsageTotals {
  total_tokens: number; total_cost: number; total_calls: number
}

export interface ModelStat {
  model: string; tokens: number; calls: number
}

export interface JournalEntry {
  id: number; title: string; content: string; created_at: string
}

export interface Client {
  id: number; name: string; email: string; company: string; notes: string; created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'; content: string
}

export interface OllamaResponse {
  message: { role: string; content: string }
  prompt_eval_count?: number; eval_count?: number; error?: string
}
