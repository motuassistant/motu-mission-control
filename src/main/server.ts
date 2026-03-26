import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import db from './db'
import { syncCronJob } from './agent-loop'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'app://.', 'http://localhost'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  })
)

// ── Helpers ───────────────────────────────────────────────
function syncAgentStatus() {
  const activeTask = db.prepare(`
    SELECT t.title FROM tasks t WHERE t.status = 'active' ORDER BY t.updated_at DESC LIMIT 1
  `).get() as any

  if (activeTask) {
    db.prepare(`
      UPDATE agent_status SET
        status = 'active',
        current_activity = ?,
        bandwidth = 65,
        last_active = datetime('now')
      WHERE id = 1
    `).run(`Working on: ${activeTask.title}`)
  } else {
    db.prepare(`
      UPDATE agent_status SET
        status = 'idle',
        current_activity = 'No activity today',
        bandwidth = 0,
        last_active = datetime('now')
      WHERE id = 1
    `).run()
  }
}

// ── Agents ────────────────────────────────────────────────
app.get('/api/agents', (c) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY is_commander DESC, created_at ASC').all()
  return c.json(agents)
})

app.post('/api/agents', async (c) => {
  const body = await c.req.json()
  const { name, role, description, avatar = '🤖', color = '#58a6ff', model } = body
  const result = db
    .prepare('INSERT INTO agents (name, role, description, avatar, color, model) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, role, description, avatar, color, model ?? null)
  db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
    'success', `New agent "${name}" joined as ${role}`
  )
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/agents/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, role, description, avatar, color, model } = body
  db.prepare(`
    UPDATE agents SET
      name        = COALESCE(?, name),
      role        = COALESCE(?, role),
      description = COALESCE(?, description),
      avatar      = COALESCE(?, avatar),
      color       = COALESCE(?, color),
      model       = COALESCE(?, model)
    WHERE id = ?
  `).run(name ?? null, role ?? null, description ?? null, avatar ?? null, color ?? null, model ?? null, id)
  return c.json({ ok: true })
})

app.delete('/api/agents/:id', (c) => {
  const id = c.req.param('id')
  const agent = db.prepare('SELECT is_commander FROM agents WHERE id = ?').get(id) as any
  if (agent?.is_commander) return c.json({ error: 'Cannot delete commander' }, 400)
  db.prepare('DELETE FROM agents WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Agent Status ──────────────────────────────────────────
app.get('/api/status', (c) => {
  return c.json(db.prepare('SELECT * FROM agent_status WHERE id = 1').get())
})

app.patch('/api/status', async (c) => {
  const body = await c.req.json()
  const { status, current_activity, bandwidth } = body
  db.prepare(`
    UPDATE agent_status SET
      status           = COALESCE(?, status),
      current_activity = COALESCE(?, current_activity),
      bandwidth        = COALESCE(?, bandwidth),
      last_active      = datetime('now')
    WHERE id = 1
  `).run(status ?? null, current_activity ?? null, bandwidth ?? null)
  return c.json({ ok: true })
})

// ── Tasks ─────────────────────────────────────────────────
function parseTasks(rows: any[]) {
  return rows.map((t) => ({
    ...t,
    tags: JSON.parse(t.tags || '[]'),
    activity_log: JSON.parse(t.activity_log || '[]')
  }))
}

app.get('/api/tasks', (c) => {
  const tasks = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.color as agent_color
    FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
    ORDER BY t.momentum DESC, t.created_at DESC
  `).all()
  return c.json(parseTasks(tasks))
})

app.get('/api/tasks/status/:status', (c) => {
  const status = c.req.param('status')
  const tasks = db.prepare(`
    SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.color as agent_color
    FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
    WHERE t.status = ?
    ORDER BY t.momentum DESC, t.created_at DESC
  `).all(status)
  return c.json(parseTasks(tasks))
})

app.post('/api/tasks', async (c) => {
  const body = await c.req.json()
  const { title, description, tags = [], momentum = 0, assigned_to = 1 } = body
  const result = db
    .prepare('INSERT INTO tasks (title, description, tags, momentum, assigned_to) VALUES (?, ?, ?, ?, ?)')
    .run(title, description, JSON.stringify(tags), momentum, assigned_to)
  db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
    'info', `New task queued: "${title}" → Motu`
  )
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/tasks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, description, status, momentum, tags, assigned_to } = body

  const current = db.prepare('SELECT title, status FROM tasks WHERE id = ?').get(id) as any

  let started_at: string | null = null
  let completed_at: string | null = null
  if (status === 'active') started_at = new Date().toISOString()
  if (status === 'completed') completed_at = new Date().toISOString()

  db.prepare(`
    UPDATE tasks SET
      title        = COALESCE(?, title),
      description  = COALESCE(?, description),
      status       = COALESCE(?, status),
      momentum     = COALESCE(?, momentum),
      tags         = COALESCE(?, tags),
      assigned_to  = COALESCE(?, assigned_to),
      started_at   = CASE WHEN ? IS NOT NULL THEN ? ELSE started_at   END,
      completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END,
      updated_at   = datetime('now')
    WHERE id = ?
  `).run(
    title ?? null, description ?? null, status ?? null, momentum ?? null,
    tags ? JSON.stringify(tags) : null, assigned_to ?? null,
    started_at, started_at,
    completed_at, completed_at,
    id
  )

  // Status change side-effects
  if (status && current && status !== current.status) {
    const taskTitle = title ?? current.title

    if (status === 'completed') {
      // Auto-create commit
      db.prepare('INSERT INTO commits (message, author) VALUES (?, ?)').run(
        `feat: complete "${taskTitle}"`, 'Motu'
      )
      db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
        'success', `Motu completed: "${taskTitle}"`
      )
    } else if (status === 'active') {
      db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
        'info', `Motu started: "${taskTitle}"`
      )
    } else if (status === 'queued') {
      db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
        'warn', `Task moved back to queue: "${taskTitle}"`
      )
    }

    // Always re-derive agent status from actual task state
    syncAgentStatus()
  }

  return c.json({ ok: true })
})

app.delete('/api/tasks/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  syncAgentStatus()
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
  return c.json(db.prepare('SELECT * FROM commits ORDER BY created_at DESC LIMIT 30').all())
})

app.post('/api/commits', async (c) => {
  const body = await c.req.json()
  const { message, author = 'Motu' } = body
  const result = db.prepare('INSERT INTO commits (message, author) VALUES (?, ?)').run(message, author)
  return c.json({ id: result.lastInsertRowid })
})

// ── Events ────────────────────────────────────────────────
app.get('/api/events', (c) => {
  return c.json(db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50').all())
})

app.post('/api/events', async (c) => {
  const body = await c.req.json()
  const { type, text } = body
  const result = db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(type, text)
  return c.json({ id: result.lastInsertRowid })
})

// ── Cron Jobs ─────────────────────────────────────────────
app.get('/api/cron-jobs', (c) => {
  return c.json(db.prepare('SELECT * FROM cron_jobs ORDER BY created_at DESC').all())
})

app.post('/api/cron-jobs', async (c) => {
  const body = await c.req.json()
  const { name, schedule, description } = body
  const result = db
    .prepare('INSERT INTO cron_jobs (name, schedule, description) VALUES (?, ?, ?)')
    .run(name, schedule, description)
  db.prepare('INSERT INTO events (type, text) VALUES (?, ?)').run(
    'info', `Cron job scheduled: "${name}" at ${schedule}`
  )
  syncCronJob(Number(result.lastInsertRowid))
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/cron-jobs/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { enabled, last_run, next_run, name, schedule, description } = body
  db.prepare(`
    UPDATE cron_jobs SET
      enabled     = COALESCE(?, enabled),
      last_run    = COALESCE(?, last_run),
      next_run    = COALESCE(?, next_run),
      name        = COALESCE(?, name),
      schedule    = COALESCE(?, schedule),
      description = COALESCE(?, description)
    WHERE id = ?
  `).run(
    enabled ?? null, last_run ?? null, next_run ?? null,
    name ?? null, schedule ?? null, description ?? null, id
  )
  syncCronJob(Number(id))
  return c.json({ ok: true })
})

app.delete('/api/cron-jobs/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id)
  syncCronJob(Number(id))
  return c.json({ ok: true })
})

// ── Hub ───────────────────────────────────────────────────
app.get('/api/hub', (c) => {
  return c.json(db.prepare('SELECT * FROM agent_messages ORDER BY created_at ASC').all())
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
  const rows = db.prepare('SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 100').all()
  const totals = db.prepare(`
    SELECT
      SUM(total_tokens)  as total_tokens,
      SUM(estimated_cost) as total_cost,
      COUNT(*)           as total_calls
    FROM api_usage
  `).get()
  const byModel = db.prepare(`
    SELECT model, SUM(total_tokens) as tokens, COUNT(*) as calls
    FROM api_usage GROUP BY model ORDER BY tokens DESC
  `).all()
  return c.json({ rows, totals, byModel })
})

app.post('/api/usage', async (c) => {
  const body = await c.req.json()
  const { model, prompt_tokens, completion_tokens, total_tokens, estimated_cost } = body
  db.prepare(`
    INSERT INTO api_usage (model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
    VALUES (?, ?, ?, ?, ?)
  `).run(model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
  return c.json({ ok: true })
})

// ── Journal ───────────────────────────────────────────────
app.get('/api/journal', (c) => {
  return c.json(db.prepare('SELECT * FROM journal_entries ORDER BY created_at DESC').all())
})

app.post('/api/journal', async (c) => {
  const body = await c.req.json()
  const { title, content } = body
  const result = db
    .prepare('INSERT INTO journal_entries (title, content) VALUES (?, ?)')
    .run(title, content)
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/journal/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { title, content } = body
  db.prepare(`
    UPDATE journal_entries SET
      title   = COALESCE(?, title),
      content = COALESCE(?, content)
    WHERE id = ?
  `).run(title ?? null, content ?? null, id)
  return c.json({ ok: true })
})

app.delete('/api/journal/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// ── Clients ───────────────────────────────────────────────
app.get('/api/clients', (c) => {
  return c.json(db.prepare('SELECT * FROM clients ORDER BY name ASC').all())
})

app.post('/api/clients', async (c) => {
  const body = await c.req.json()
  const { name, email, company, notes } = body
  const result = db
    .prepare('INSERT INTO clients (name, email, company, notes) VALUES (?, ?, ?, ?)')
    .run(name, email ?? null, company ?? null, notes ?? null)
  return c.json({ id: result.lastInsertRowid })
})

app.patch('/api/clients/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, email, company, notes } = body
  db.prepare(`
    UPDATE clients SET
      name    = COALESCE(?, name),
      email   = COALESCE(?, email),
      company = COALESCE(?, company),
      notes   = COALESCE(?, notes)
    WHERE id = ?
  `).run(name ?? null, email ?? null, company ?? null, notes ?? null, id)
  return c.json({ ok: true })
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
      const total = (data.prompt_eval_count || 0) + (data.eval_count || 0)
      db.prepare(`
        INSERT INTO api_usage (model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
        VALUES (?, ?, ?, ?, 0)
      `).run(model, data.prompt_eval_count || 0, data.eval_count || 0, total)
    }

    return c.json(data)
  } catch {
    return c.json({ error: 'Could not reach Ollama. Is it running on your beefy PC?' }, 503)
  }
})

// ── Ollama Models ─────────────────────────────────────────
// Proxies Ollama's /api/tags to get available models.
// Frontend calls this instead of hitting Ollama directly
// (avoids CORS issues and keeps the host config server-side).
app.get('/api/ollama/models', async (c) => {
  const settings = db.prepare('SELECT * FROM settings').all() as any[]
  const settingsMap: Record<string, string> = {}
  settings.forEach((s) => { settingsMap[s.key] = s.value })

  const host = settingsMap.ollama_host ?? 'http://localhost:11434'

  try {
    const response = await fetch(`${host}/api/tags`)
    const data = await response.json() as any
    // data.models is an array of { name, modified_at, size, ... }
    const models = (data.models ?? []).map((m: any) => m.name as string)
    return c.json({ models })
  } catch {
    return c.json({ models: [], error: 'Could not reach Ollama' })
  }
})

// ── Dev: Clear Database ───────────────────────────────────
// Truncates all user data tables. Keeps settings and the
// Motu commander agent. Only exposed in dev builds.
app.post('/api/dev/clear-db', (c) => {
  db.exec(`
    DELETE FROM tasks;
    DELETE FROM commits;
    DELETE FROM events;
    DELETE FROM agent_messages;
    DELETE FROM api_usage;
    DELETE FROM journal_entries;
    DELETE FROM clients;
    DELETE FROM cron_jobs;
    DELETE FROM agent_status;
    INSERT OR IGNORE INTO agent_status (id) VALUES (1);
    DELETE FROM agents WHERE is_commander = 0;
  `)
  return c.json({ ok: true })
})


// ── Settings ──────────────────────────────────────────────
app.get('/api/settings', (c) => {
  const settings = db.prepare('SELECT * FROM settings').all() as any[]
  const obj: Record<string, string> = {}
  settings.forEach((s) => { obj[s.key] = s.value })
  return c.json(obj)
})

app.patch('/api/settings', async (c) => {
  const body = await c.req.json()
  for (const [key, value] of Object.entries(body)) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value as string)
  }
  return c.json({ ok: true })
})

export function startServer(port = 3001): void {
  serve({ fetch: app.fetch, port })
  console.log(`Motu server running on http://localhost:${port}`)
}
