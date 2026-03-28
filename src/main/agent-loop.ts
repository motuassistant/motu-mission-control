import cron, { type ScheduledTask } from 'node-cron'
import db from './db'

// ── Ollama reasoning loop ─────────────────────────────────
// Picks up queued tasks, calls Ollama to reason through them,
// logs the response to the task activity log, marks complete.
// This is the "think" layer — actual execution needs OpenClaw.

async function runTask(taskId: number): Promise<void> {
  const task = db.prepare(`
    SELECT t.*, a.name as agent_name, a.model as agent_model
    FROM tasks t LEFT JOIN agents a ON t.assigned_to = a.id
    WHERE t.id = ?
  `).get(taskId) as any

  if (!task) return

  const settings = db.prepare('SELECT * FROM settings').all() as any[]
  const settingsMap: Record<string, string> = {}
  settings.forEach((s) => { settingsMap[s.key] = s.value })

  const ollamaHost  = settingsMap.ollama_host  ?? 'http://localhost:11434'
  const globalModel = settingsMap.ollama_model ?? 'llama3'
  const model       = task.agent_model ?? globalModel

  // Mark task as active
  db.prepare(`UPDATE tasks SET status = 'active', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(taskId)
  db.prepare(`INSERT INTO events (type, text) VALUES ('info', ?)`).run(`Motu picked up task: "${task.title}"`)

  // Sync agent status
  db.prepare(`UPDATE agent_status SET status = 'active', current_activity = ?, bandwidth = 65, last_active = datetime('now') WHERE id = 1`).run(`Working on: ${task.title}`)

  // Log start to activity log
  appendLog(taskId, `Started reasoning about: ${task.title}`, 'info')

  try {
    const response = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are ${task.agent_name ?? 'Motu'}, an autonomous AI agent. When given a task, reason through it step by step and provide a detailed plan or response. Be specific and actionable.`
          },
          {
            role: 'user',
            content: `Task: ${task.title}\n\n${task.description ? `Details: ${task.description}` : ''}\n\nReason through this task and provide your analysis, plan, or response.`
          }
        ]
      })
    })

    const data = await response.json() as any

    if (data.message?.content) {
      // Log Ollama's response to the task activity log
      appendLog(taskId, data.message.content, 'success')

      // Log token usage
      if (data.prompt_eval_count || data.eval_count) {
        const total = (data.prompt_eval_count || 0) + (data.eval_count || 0)
        db.prepare(`INSERT INTO api_usage (model, prompt_tokens, completion_tokens, total_tokens, estimated_cost) VALUES (?, ?, ?, ?, 0)`)
          .run(model, data.prompt_eval_count || 0, data.eval_count || 0, total)
      }

      // Mark complete
      db.prepare(`UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(taskId)
      db.prepare(`INSERT INTO commits (message, author) VALUES (?, ?)`).run(`feat: complete "${task.title}"`, task.agent_name ?? 'Motu')
      db.prepare(`INSERT INTO events (type, text) VALUES ('success', ?)`).run(`Motu completed: "${task.title}"`)
      appendLog(taskId, `Task completed`, 'success')
    } else {
      appendLog(taskId, `Ollama returned no response — task left active for manual review`, 'warn')
      db.prepare(`INSERT INTO events (type, text) VALUES ('warn', ?)`).run(`No response from Ollama for: "${task.title}"`)
    }
  } catch (err: any) {
    appendLog(taskId, `Could not reach Ollama: ${err?.message ?? 'unknown error'}`, 'error')
    db.prepare(`INSERT INTO events (type, text) VALUES ('error', ?)`).run(`Ollama unreachable during: "${task.title}"`)
    // Move back to queued so it can be retried
    db.prepare(`UPDATE tasks SET status = 'queued', started_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(taskId)
  } finally {
    // Re-sync agent status from actual task state
    const stillActive = db.prepare(`SELECT id FROM tasks WHERE status = 'active' LIMIT 1`).get()
    if (!stillActive) {
      db.prepare(`UPDATE agent_status SET status = 'idle', current_activity = 'No activity today', bandwidth = 0, last_active = datetime('now') WHERE id = 1`).run()
    }
  }
}

function appendLog(taskId: number, text: string, type: string): void {
  const task = db.prepare('SELECT activity_log FROM tasks WHERE id = ?').get(taskId) as any
  if (!task) return
  const log = JSON.parse(task.activity_log || '[]')
  log.push({ text, type, created_at: new Date().toISOString() })
  db.prepare('UPDATE tasks SET activity_log = ? WHERE id = ?').run(JSON.stringify(log), taskId)
}

// ── Agent execution loop ──────────────────────────────────
// Runs every 2 minutes. Picks up next queued task assigned to Motu.
// Processes one task at a time to avoid Ollama overload.

let loopRunning = false

export function startAgentLoop(): void {
  cron.schedule('*/2 * * * *', async () => {
    if (loopRunning) return // Don't stack if previous run is still going
    loopRunning = true

    try {
      // Only pick up if Motu is currently idle
      const status = db.prepare('SELECT status FROM agent_status WHERE id = 1').get() as any
      if (status?.status === 'active') return

      // Get next queued task assigned to Motu (agent id = 1)
      const nextTask = db.prepare(`
        SELECT id FROM tasks WHERE status = 'queued' AND assigned_to = 1
        ORDER BY momentum DESC, created_at ASC LIMIT 1
      `).get() as any

      if (nextTask) {
        await runTask(nextTask.id)
      }
    } catch (err) {
      console.error('Agent loop error:', err)
    } finally {
      loopRunning = false
    }
  })

  console.log('Motu agent loop started -- checking for tasks every 2 minutes')
}

// ── Cron job runner ───────────────────────────────────────
// Each enabled cron job gets its own node-cron scheduled task.
// We keep a map so we can stop/restart them when jobs are
// toggled or their schedule changes — without restarting the app.

const activeCronTasks = new Map<number, ScheduledTask>()

function scheduleCronJob(job: any): void {
  // Stop existing task for this job if there is one
  const existing = activeCronTasks.get(job.id)
  if (existing) { existing.stop(); activeCronTasks.delete(job.id) }

  if (!job.enabled) return
  if (!cron.validate(job.schedule)) {
    console.warn(`Invalid cron schedule for job "${job.name}": ${job.schedule}`)
    return
  }

  const task = cron.schedule(job.schedule, () => {
    const result = db.prepare(`
      INSERT INTO tasks (title, description, tags, momentum, assigned_to)
      VALUES (?, ?, ?, 50, 1)
    `).run(
      `[Cron] ${job.name}`,
      job.description ?? `Scheduled task from cron job: ${job.name}`,
      JSON.stringify(['cron', 'scheduled'])
    )

        // Update last_run and calculate next_run
    db.prepare(`UPDATE cron_jobs SET last_run = datetime('now') WHERE id = ?`).run(job.id)
    db.prepare(`INSERT INTO events (type, text) VALUES ('info', ?)`).run(`Cron job fired: "${job.name}" -- task queued`)
    console.log(`Cron job fired: ${job.name} -> task ${result.lastInsertRowid} queued`)
  })

  activeCronTasks.set(job.id, task)
  console.log(`Cron job scheduled: "${job.name}" at ${job.schedule}`)
}

export function startCronRunner(): void {
  const jobs = db.prepare('SELECT * FROM cron_jobs WHERE enabled = 1').all() as any[]
  jobs.forEach(scheduleCronJob)
  console.log(`Cron runner started -- ${jobs.length} job(s) active`)
}

// Call this from the API when a job is created, updated, or toggled
// so changes take effect immediately without restarting the app
export function syncCronJob(jobId: number): void {
  const job = db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(jobId) as any
  if (!job) {
    const existing = activeCronTasks.get(jobId)
    if (existing) { existing.stop(); activeCronTasks.delete(jobId) }
    return
  }
  scheduleCronJob(job)
}
