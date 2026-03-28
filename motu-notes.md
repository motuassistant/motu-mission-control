# Motu Mission Control — Project Notes
# Last updated: March 2026

---

## Stack

- **Electron 39** + electron-vite + React 19 + TypeScript
- **Hono** backend running inside Electron main process on port 3001
- **better-sqlite3** — local SQLite database
- **node-cron** — scheduled jobs and agent execution loop
- **React Router** (MemoryRouter) for client-side routing
- **Ollama** — LLM inference, running on beefy PC over LAN (port 11434)
- **OpenClaw** — execution engine (integration pending, see Future Plan)
- Zustand installed but currently unused

## Physical Architecture
- Old laptop runs the entire Electron app: UI renderer, Hono API server, SQLite DB, agent loop, cron runner
- Beefy PC runs Ollama only (port 11434) — accessible over LAN
- ragpedia.net is a separate planned site (not built)

```
Old laptop
  └── Electron app
        ├── Renderer (React UI)
        ├── Hono API server (port 3001)
        ├── SQLite database (motu.db in userData)
        ├── Agent loop (node-cron, every 2 min)
        └── Cron runner (per-job ScheduledTask instances)

Beefy PC
  └── Ollama server (port 11434)
        └── Models: e.g. llama3:latest, qwen3:4b, etc.

ragpedia.net
  └── Separate Cloudflare + Hono + React site (not yet built)
```

---

## Database Schema (`src/main/db.ts`)

| Table | Purpose |
|---|---|
| `agents` | Agent registry. Motu is id=1, is_commander=1, cannot be deleted. Has `model` column for per-agent Ollama model override |
| `tasks` | Work queue. status: queued / active / completed. Has `activity_log` (JSON array), `momentum` score, `assigned_to` FK to agents, `started_at`, `completed_at` |
| `commits` | Auto-created when tasks complete |
| `events` | System event log — type: info / success / warn / error |
| `cron_jobs` | Scheduled job definitions with schedule (cron expression), enabled flag, last_run |
| `agent_messages` | Hub chat history. `from_agent` and `to_agent` columns isolate per-agent conversations |
| `api_usage` | Ollama token usage per call (model, prompt_tokens, completion_tokens, estimated_cost) |
| `agent_status` | Single row (id=1). Motu's live status, current_activity, bandwidth |
| `journal_entries` | Personal journal |
| `clients` | Client CRM |
| `settings` | Key/value: ollama_host, ollama_model, heartbeat_interval |

**Safe migrations**: `db.ts` uses `PRAGMA table_info` to add new columns to existing DBs without breaking them. Currently handles: `agents.model`.

---

## Backend (`src/main/server.ts`)

All routes under `/api/`. Key behaviors:

- `syncAgentStatus()` — called on every task status change and delete. Derives agent status from actual active tasks. Never stale.
- Task PATCH auto-sets `started_at` / `completed_at` timestamps
- Completing a task auto-creates a commit and success event
- Starting a task logs an info event
- `GET /api/ollama/models` — proxies Ollama `/api/tags` to avoid CORS, uses stored host from settings
- `POST /api/dev/clear-db` — truncates all user data, keeps settings and Motu agent
- `syncCronJob(id)` exported from agent-loop and called after cron create/patch/delete so schedule changes take effect immediately without restart
- `PATCH /api/settings` — saves key/value pairs, used by ApiUsage page

---

## Agent Loop (`src/main/agent-loop.ts`)

### Execution loop — runs every 2 minutes via node-cron:

1. Skip if already running (`loopRunning` flag prevents stacking)
2. Skip if Motu's status is already `active`
3. Query next queued task assigned to Motu (id=1), ordered by momentum DESC, then created_at ASC
4. Mark task active, update agent_status
5. Call Ollama `/api/chat` with system prompt (agent name/role) and task description
6. Log Ollama's full response to task `activity_log`
7. Log token usage to `api_usage`
8. Mark task completed, auto-create commit and success event
9. On Ollama unreachable: re-queue the task for retry, log error event
10. Always re-sync agent_status from actual task state in `finally` block

### Cron runner

- Each enabled cron job gets its own `ScheduledTask` instance stored in `activeCronTasks` Map (keyed by job id)
- `syncCronJob(id)` stops the existing task and starts a new one when a job is created, updated, or toggled — no restart needed
- Fired jobs create a task in the queue (title: `[Cron] Job Name`, tags: `['cron', 'scheduled']`) which the agent loop picks up normally

---

## Frontend Structure

```
src/renderer/src/
├── lib/
│   ├── api.ts                — typed fetch client for all backend endpoints
│   ├── SearchContext.tsx     — global search query, cleared on every route change
│   └── SettingsContext.tsx   — settings loaded once on app start, shared app-wide via useSettings()
├── components/
│   ├── Sidebar.tsx           — polls status + task count every 8s. Shows active dot, queue badge on Workshop
│   └── TopBar.tsx            — search input wired to SearchContext, 30-min countdown timer
└── pages/
    ├── Dashboard.tsx         — live status card, workshop stats, recent commits, system events. Auto-refreshes every 8s
    ├── Workshop.tsx          — list / kanban / live feed views. Search applies to all three. Status filter on list view only
    ├── TheHub.tsx            — per-agent chat. Messages filtered by selected agent. System prompt built from agent description. Per-agent model
    ├── Agents.tsx            — CRUD grid. Motu has model-only edit button. Per-agent Ollama model override shown as badge
    ├── ModelSelect.tsx       — reusable dropdown that fetches Ollama models. Auto-selects first if current value not in list. Falls back to text input if unreachable
    ├── Intelligence.tsx      — research input → Ollama → JSON items → localStorage
    ├── WeeklyRecaps.tsx      — Ollama narrative summary of tasks/commits/events → localStorage
    ├── Journal.tsx           — two-pane CRUD (list + content)
    ├── Documents.tsx         — file upload + drag-drop, stored in localStorage (50k char cap per file)
    ├── Clients.tsx           — CRUD card grid
    ├── CronJobs.tsx          — CRUD with schedule presets. Enable/disable toggle wires to syncCronJob immediately
    └── ApiUsage.tsx          — token stats, model dropdown with auto-refresh, Ollama settings, developer clear DB
```

**Navigation**: MAIN (Dashboard, Journal, Documents) · MOTU (Agents, Intelligence, The Hub, Weekly Recaps) · OPERATIONS (Clients, Cron Jobs, API Usage, Workshop)

---

## Context System

### SearchContext
- Single `query` string, `setQuery` function
- Cleared automatically on every route change in `AppShell`
- All pages read `useSearch()` and filter their data client-side
- TopBar writes to it, pages read from it

### SettingsContext
- Loads settings from `/api/settings` once on app start
- Exposes `settings` (Record<string, string>), `loaded` (boolean), `saveSettings` (async function)
- `saveSettings` updates the server and merges into local cache immediately — no re-fetch needed
- All pages that need Ollama host/model use `useSettings()` instead of calling `getSettings()` on mount
- Eliminates per-page load delay and race conditions on first render

---

## Known Limitations (Current State)

1. **Documents, Intelligence, Weekly Recaps use localStorage** — data is not in the DB and therefore not accessible to the agent loop or backend. Should be migrated to DB tables.
2. **Agent loop only "thinks"** — calls Ollama, logs the response, marks complete. Cannot execute anything in the real world yet. That is the OpenClaw integration.
3. **All tasks route to Motu (id=1)** — sub-agents exist in the UI but the loop doesn't route tasks to them.
4. **No failed task status** — tasks that error out get re-queued silently. There is no `failed` state visible in the UI.
5. **No real-time activity log streaming** — activity_log only updates when the task completes or errors, not during execution.
6. **Sidebar badge refreshes every 8s** — minor lag, acceptable for now.

---

## OpenClaw Integration — Future Development Plan

### What OpenClaw is

OpenClaw is an autonomous agent execution engine. In the context of Motu Mission Control:

- **Ollama is the brain** — it reasons about tasks, decides what needs to be done, and produces a structured plan
- **OpenClaw is the hands** — it receives that plan and actually executes it: writing code, running terminal commands, editing files, calling external services

This is a local, fully offline-capable setup. No paid APIs required.

### The full intended execution loop

```
Task created (manual via Workshop UI, or auto via Cron job)
    ↓
Agent loop picks up next queued task
    ↓
Ollama called with structured prompt → returns JSON action plan
    ↓
Action plan passed to OpenClaw bridge module
    ↓
OpenClaw executes each action sequentially:
  - write_file: creates or edits files on disk
  - run_command: executes shell commands in a configured working directory
  - call_service: calls external APIs or services (email, calendar, etc.)
    ↓
Execution results streamed back to task activity_log in real time
    ↓
Task marked completed or failed
Commit auto-created on success
```

### What needs to be built

#### 1. Structured JSON output from Ollama (`agent-loop.ts`)

Currently Ollama returns free-text. For OpenClaw to act on it, the system prompt needs to request structured JSON:

```typescript
const systemPrompt = `
You are ${agentName}, an autonomous agent. When given a task, respond ONLY with a
valid JSON object in this exact format:
{
  "reasoning": "brief explanation of your approach",
  "actions": [
    { "type": "write_file", "path": "relative/path/to/file.ts", "content": "..." },
    { "type": "run_command", "command": "npm install lodash" },
    { "type": "call_service", "service": "gmail", "action": "send", "args": { "to": "...", "subject": "...", "body": "..." } }
  ]
}
`
```

#### 2. OpenClaw bridge module (`src/main/openclaw.ts` — new file)

A module that takes the parsed JSON plan and executes each action. This is where OpenClaw's own API/interface gets called. The exact implementation depends on OpenClaw's interface — likely a local server, CLI, or Node SDK.

The module needs to:
- Accept a parsed action plan and a task ID
- Execute each action in sequence
- Stream progress back by appending to the task's `activity_log` in real time
- Return success/failure for each action
- Abort remaining actions if a critical one fails

#### 3. New settings for OpenClaw (`settings` table + `ApiUsage.tsx`)

New keys to add:
- `openclaw_enabled` — boolean toggle, defaults to false (safe default, keeps current Ollama-only mode)
- `openclaw_host` — where OpenClaw is running (e.g. `http://localhost:XXXX`) — to be confirmed based on OpenClaw's interface
- `openclaw_working_dir` — the directory OpenClaw operates in (e.g. path to a project repo)
- `openclaw_allowed_actions` — comma-separated whitelist: `write_file,run_command,call_service`

These should appear as a new "OpenClaw Settings" section in `ApiUsage.tsx`.

#### 4. New task status: `failed`

Currently: `queued → active → completed`. Need to add `failed`:

- Update the DB CHECK constraint: `CHECK(status IN ('queued','active','completed','failed'))`
- Add `badge-failed` CSS class (red)
- Show failed tasks in kanban as a fourth column or as a separate indicator
- Failed tasks should be retryable (button to re-queue them)
- The agent loop should mark a task failed after N retries rather than re-queuing indefinitely

#### 5. Real-time activity log streaming

Currently `activity_log` only gets written when the task completes or errors. With OpenClaw executing multi-step actions, you want to see each step as it happens:

- The Workshop task detail modal should poll `GET /api/tasks/:id` every 2-3 seconds while the task is active
- Or: implement a simple SSE (Server-Sent Events) endpoint in Hono that pushes task updates to the renderer

#### 6. Sub-agent routing

Currently all tasks go to Motu (id=1). With multiple agents each potentially running different models or having different capabilities:

- Add `capabilities` column to `agents` table (JSON array, e.g. `["code", "email", "research"]`)
- Task creation can optionally specify `required_capability`
- Agent loop queries: find the best available idle agent whose capabilities match the task
- This lets you have a "Code Agent" running a code-focused model and an "Email Agent" that handles communication tasks

#### 7. External service integration via cron jobs

The cron jobs system is designed to trigger recurring agent tasks like "check email and delete spam" or "send weekly report". For these to actually work:

- OpenClaw needs access to external services (Gmail, Calendar, etc.)
- The task description from the cron job needs to be specific enough for Ollama to generate a valid action plan
- Example: cron job named "Morning Email Triage" with description "Check Gmail inbox, delete obvious spam, flag anything needing a response, summarize what's there"
- Ollama turns this into a `call_service` action targeting Gmail
- OpenClaw executes it

The Gmail and Google Calendar MCP servers already connected to Claude.ai are the right tools here — OpenClaw would need to be configured to use them in the same way.

#### 8. Safety controls (important before enabling OpenClaw)

Before OpenClaw executes anything destructive:
- **Dry-run mode**: log the planned actions without executing, let the user review
- **Action whitelist**: `openclaw_allowed_actions` in settings limits what action types are permitted
- **Confirmation for destructive actions**: any action involving deletion or sending external communications should require explicit approval in the UI
- **Max actions per task**: prevent runaway execution
- **Sandboxed working directory**: OpenClaw should only be able to write files within `openclaw_working_dir`, not anywhere on disk

---

## Suggested Build Order for OpenClaw Integration

1. Add `failed` status to DB schema and update all UI that touches task status
2. Add real-time activity log polling to the task detail modal in Workshop
3. Add OpenClaw settings to the settings table and ApiUsage page
4. Build `src/main/openclaw.ts` bridge module (implementation depends on OpenClaw's interface)
5. Update `agent-loop.ts` to use structured JSON prompts when `openclaw_enabled` is true
6. Wire OpenClaw execution into the agent loop after Ollama returns a plan
7. Add `capabilities` to agents table and implement sub-agent routing
8. Implement safety controls and dry-run mode
9. Test end-to-end with a simple task: e.g. "Create a hello.txt file in the working directory"
10. Build up to more complex tasks: file edits, shell commands, then external services