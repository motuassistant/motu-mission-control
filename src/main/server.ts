import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import db from './db'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'app://.', 'http://localhost'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  })
)

// ── Agents ────────────────────────────────────────────────
app.get('/api/agents', (c) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY is_commander DESC, created_at ASC').all()
  return c.json(agents)
})

app.post('/api/agents', async (c) => {
  const body = await c.req.json()
  const { name, role, description, avatar = '🤖', color = '#3b82f6' } = body
  const result = db
    .prepare('INSERT INTO agents (name, role, description, avatar, color) VALUES (?, ?, ?, ?, ?)')
    .run(name, role, description, avatar, color)
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/agents/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, role, description, avatar, color } = body
  db.prepare(`
    UPDATE agents SET
      name = COALESCE(?, name),
      role = COALESCE(?, role),
      description = COALESCE(?, description),
      avatar = COALESCE(?, avatar),
      color = COALESCE(?, color)
    WHERE id = ?
  `).run(name ?? null, role ?? null, description ?? null, avatar ?? null, color ?? null, id)
  return c.json({ ok: true })
})

app.delete('/api/agents/:id', (c) => {
  const id = c.req.param('id')
  // Prevent deleting Motu (commander)
  const agent = db.prepare('SELECT is_commander FROM agents WHERE id = ?').get(id) as any
  if (agent?.is_commander) return c.json({ error: 'Cannot delete commander' }, 400)
  db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Agent Status ──────────────────────────────────────────
app.get('/api/status', (c) => {
  const status = db.prepare('SELECT * FROM agent_status WHERE id = 1').get()
  return c.json(status)
})

app.patch('/api/status', async (c) => {
  const body = await c.req.json()
  const { status, current_activity, bandwidth } = body
  db.prepare(`
    UPDATE agent_status SET
      status = COALESCE(?, status),
      current_activity = COALESCE(?, current_activity),
      bandwidth = COALESCE(?, bandwidth),
      last_active = datetime('now')
    WHERE id = 1
  `).run(status ?? null, current_activity ?? null, bandwidth ?? null)
  return c.json({ ok: true })
})

// ── Tasks ─────────────────────────────────────────────────
app.get('/api/tasks', (c) => {
  const tasks = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.color as agent_color
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_to = a.id
       ORDER BY t.momentum DESC, t.created_at DESC`
    )
    .all()
  return c.json(
    tasks.map((t: any) => ({
      ...t,
      tags: JSON.parse(t.tags || '[]'),
      activity_log: JSON.parse(t.activity_log || '[]')
    }))
  )
})

app.get('/api/tasks/status/:status', (c) => {
  const status = c.req.param('status')
  const tasks = db
    .prepare(
      `SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.color as agent_color
       FROM tasks t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.status = ?
       ORDER BY t.momentum DESC, t.created_at DESC`
    )
    .all(status)
  return c.json(
    tasks.map((t: any) => ({
      ...t,
      tags: JSON.parse(t.tags || '[]'),
      activity_log: JSON.parse(t.activity_log || '[]')
    }))
  )
})

app.post('/api/tasks', async (c) => {
  const body = await c.req.json()
  const { title, description, tags = [], momentum = 0, assigned_to = 1 } = body
  const result = db
    .prepare(
      'INSERT INTO tasks (title, description, tags, momentum, assigned_to) VALUES (?, ?, ?, ?, ?)'
    )
    .run(title, description, JSON.stringify(tags), momentum, assigned_to)

  // Log event
  db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
    'info',
    `New task queued: "${title}" assigned to Motu`
  )

  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/tasks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, description, status, momentum, tags, assigned_to } = body

  // Auto-set timestamps on status change
  let started_at = null
  let completed_at = null
  if (status === 'active') started_at = new Date().toISOString()
  if (status === 'completed') completed_at = new Date().toISOString()

  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      momentum = COALESCE(?, momentum),
      tags = COALESCE(?, tags),
      assigned_to = COALESCE(?, assigned_to),
      started_at = CASE WHEN ? IS NOT NULL THEN ? ELSE started_at END,
      completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null,
    description ?? null,
    status ?? null,
    momentum ?? null,
    tags ? JSON.stringify(tags) : null,
    assigned_to ?? null,
    started_at, started_at,
    completed_at, completed_at,
    id
  )
  return c.json({ ok: true })
})

app.delete('/api/tasks/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return c.json({ ok: true })
})

app.post('/api/tasks/:id/log', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { text, type = 'info' } = body
  const task = db.prepare('SELECT activity_log FROM tasks WHERE id = ?').get(id) as any
  if (!task) return c.json({ error: 'Not found' }, 404)
  const log = JSON.parse(task.activity_log || '[]')
  log.push({ text, type, created_at: new Date().toISOString() })
  db.prepare('UPDATE tasks SET activity_log = ? WHERE id = ?').run(JSON.stringify(log), id)
  return c.json({ ok: true })
})

// ── Commits ───────────────────────────────────────────────
app.get('/api/commits', (c) => {
  const commits = db
    .prepare('SELECT * FROM commits ORDER BY created_at DESC LIMIT 20')
    .all()
  return c.json(commits)
})

app.post('/api/commits', async (c) => {
  const body = await c.req.json()
  const { message, author = 'Motu' } = body
  const result = db
    .prepare('INSERT INTO commits (message, author) VALUES (?, ?)')
    .run(message, author)
  return c.json({ id: result.lastInsertRowid })
})

// ── Events ────────────────────────────────────────────────
app.get('/api/events', (c) => {
  const events = db
    .prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50')
    .all()
  return c.json(events)
})

app.post('/api/events', async (c) => {
  const body = await c.req.json()
  const { type, text } = body
  const result = db
    .prepare('INSERT INTO events (type, text) VALUES (?, ?)')
    .run(type, text)
  return c.json({ id: result.lastInsertRowid })
})

// ── Cron Jobs ─────────────────────────────────────────────
app.get('/api/cron-jobs', (c) => {
  const jobs = db.prepare('SELECT * FROM cron_jobs ORDER BY created_at DESC').all()
  return c.json(jobs)
})

app.post('/api/cron-jobs', async (c) => {
  const body = await c.req.json()
  const { name, schedule, description } = body
  const result = db
    .prepare('INSERT INTO cron_jobs (name, schedule, description) VALUES (?, ?, ?)')
    .run(name, schedule, description)
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/cron-jobs/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { enabled, last_run, next_run } = body
  db.prepare(`
    UPDATE cron_jobs SET
      enabled = COALESCE(?, enabled),
      last_run = COALESCE(?, last_run),
      next_run = COALESCE(?, next_run)
    WHERE id = ?
  `).run(enabled ?? null, last_run ?? null, next_run ?? null, id)
  return c.json({ ok: true })
})

app.delete('/api/cron-jobs/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Hub ───────────────────────────────────────────────────
app.get('/api/hub', (c) => {
  const messages = db
    .prepare('SELECT * FROM agent_messages ORDER BY created_at ASC')
    .all()
  return c.json(messages)
})

app.post('/api/hub', async (c) => {
  const body = await c.req.json()
  const { from_agent, to_agent, message } = body
  const result = db
    .prepare('INSERT INTO agent_messages (from_agent, to_agent, message) VALUES (?, ?, ?)')
    .run(from_agent, to_agent ?? null, message)
  return c.json({ id: result.lastInsertRowid })
})

// ── API Usage ─────────────────────────────────────────────
app.get('/api/usage', (c) => {
  const rows = db
    .prepare('SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 50')
    .all()
  const totals = db
    .prepare(
      `SELECT
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        COUNT(*) as total_calls
       FROM api_usage`
    )
    .get()
  return c.json({ rows, totals })
})

app.post('/api/usage', async (c) => {
  const body = await c.req.json()
  const { model, prompt_tokens, completion_tokens, total_tokens, estimated_cost } = body
  db.prepare(
    'INSERT INTO api_usage (model, prompt_tokens, completion_tokens, total_tokens, estimated_cost) VALUES (?, ?, ?, ?, ?)'
  ).run(model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
  return c.json({ ok: true })
})

// ── Journal ───────────────────────────────────────────────
app.get('/api/journal', (c) => {
  const entries = db
    .prepare('SELECT * FROM journal_entries ORDER BY created_at DESC')
    .all()
  return c.json(entries)
})

app.post('/api/journal', async (c) => {
  const body = await c.req.json()
  const { title, content } = body
  const result = db
    .prepare('INSERT INTO journal_entries (title, content) VALUES (?, ?)')
    .run(title, content)
  return c.json({ id: result.lastInsertRowid })
})

app.delete('/api/journal/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Clients ───────────────────────────────────────────────
app.get('/api/clients', (c) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all()
  return c.json(clients)
})

app.post('/api/clients', async (c) => {
  const body = await c.req.json()
  const { name, email, company, notes } = body
  const result = db
    .prepare('INSERT INTO clients (name, email, company, notes) VALUES (?, ?, ?, ?)')
    .run(name, email, company, notes)
  return c.json({ id: result.lastInsertRowid })
})

app.delete('/api/clients/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM clients WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Ollama Chat ───────────────────────────────────────────
app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { messages, model = 'llama3', ollamaHost } = body
  const host = ollamaHost || 'http://localhost:11434'

  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false })
    })
    const data = (await response.json()) as any

    if (data.prompt_eval_count || data.eval_count) {
      const totalTokens = (data.prompt_eval_count || 0) + (data.eval_count || 0)
      db.prepare(
        'INSERT INTO api_usage (model, prompt_tokens, completion_tokens, total_tokens, estimated_cost) VALUES (?, ?, ?, ?, ?)'
      ).run(model, data.prompt_eval_count || 0, data.eval_count || 0, totalTokens, 0)
    }

    return c.json(data)
  } catch {
    return c.json({ error: 'Could not reach Ollama. Is it running?' }, 503)
  }
})

export function startServer(port = 3001): void {
  serve({ fetch: app.fetch, port })
  console.log(`Motu server running on http://localhost:${port}`)
}
