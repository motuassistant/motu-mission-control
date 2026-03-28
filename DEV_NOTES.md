## Motu Mission Control — Full Project Notes

---

### What's been built

**Stack**
- Electron 39 + electron-vite + React 19 + TypeScript
- Hono backend running inside the Electron main process on port 3001
- better-sqlite3 for local SQLite database
- node-cron for scheduled jobs and the agent loop
- React Router (MemoryRouter) for client-side routing
- Zustand installed but unused — state is local React state + two React contexts

**Architecture**
- Old laptop runs the entire Electron app: UI renderer, Hono API server, SQLite DB, agent loop, cron runner
- Beefy PC runs Ollama only (port 11434) — accessible over LAN
- ragpedia.net is a separate planned site (not built)

---

### Database schema (`src/main/db.ts`)

| Table | Purpose |
|---|---|
| `agents` | Agent registry. Motu is id=1, is_commander=1, cannot be deleted |
| `tasks` | Work queue. status: queued/active/completed. Has activity_log (JSON), momentum score, assigned_to FK |
| `commits` | Auto-created when tasks complete |
| `events` | System event log (info/success/warn/error) |
| `cron_jobs` | Scheduled job definitions |
| `agent_messages` | Hub chat history, from_agent/to_agent per message |
| `api_usage` | Ollama token usage logging |
| `agent_status` | Single row (id=1), Motu's current status/activity |
| `journal_entries` | Personal journal |
| `clients` | Client CRM |
| `settings` | Key/value store: ollama_host, ollama_model, heartbeat_interval |

**Safe migrations**: `db.ts` uses `PRAGMA table_info` to add columns to existing DBs without breaking them. Currently handles: `agents.model`.

---

### Backend (`src/main/server.ts`)

All routes under `/api/`. Key behaviors:
- `syncAgentStatus()` — called on every task status change and delete. Derives agent status from actual active tasks rather than manual updates
- Task PATCH auto-sets `started_at`/`completed_at` timestamps
- Completing a task auto-creates a commit and system event
- `PATCH /api/settings` — updates settings table
- `GET /api/ollama/models` — proxies Ollama's `/api/tags` to avoid CORS, uses stored host
- `POST /api/dev/clear-db` — truncates all user data, keeps settings and Motu
- `syncCronJob(id)` called after cron create/patch/delete so changes take effect immediately

---

### Agent loop (`src/main/agent-loop.ts`)

**Agent execution loop** — runs every 2 minutes via node-cron:
1. Checks if Motu is idle
2. Picks next queued task (highest momentum first, then oldest)
3. Calls Ollama with a system prompt and task description
4. Logs Ollama's response to the task's activity_log
5. Marks task completed, auto-creates commit
6. On Ollama failure: re-queues the task for retry

**Cron runner** — each enabled cron job gets its own `ScheduledTask` stored in `activeCronTasks` Map. `syncCronJob()` stops/restarts individual jobs when toggled without restarting the app. Fired jobs create tasks in the queue which the agent loop then picks up.

---

### Frontend structure

```
src/renderer/src/
├── lib/
│   ├── api.ts              — typed fetch client for all endpoints
│   ├── SearchContext.tsx   — global search query, cleared on route change
│   └── SettingsContext.tsx — settings loaded once on app start, shared app-wide
├── components/
│   ├── Sidebar.tsx         — polls status every 8s, shows active dot + queue badge
│   └── TopBar.tsx          — search input wired to SearchContext, countdown timer
└── pages/
    ├── Dashboard.tsx       — live status, workshop stats, commits, events
    ├── Workshop.tsx        — list/kanban/live feed. Search across all three views
    ├── TheHub.tsx          — per-agent chat. Isolated history per agent. System prompt from agent description
    ├── Agents.tsx          — CRUD. Motu has model-only edit. Per-agent model override
    ├── Intelligence.tsx    — Ollama research → JSON → stored in localStorage
    ├── WeeklyRecaps.tsx    — Ollama narrative summary → stored in localStorage
    ├── Journal.tsx         — two-pane CRUD
    ├── Documents.tsx       — file upload, stored in localStorage (50k char cap)
    ├── Clients.tsx         — CRUD grid
    ├── CronJobs.tsx        — CRUD with presets. Toggle enable/disable
    ├── ApiUsage.tsx        — token stats, model dropdown, developer clear DB
    └── ModelSelect.tsx     — reusable Ollama model dropdown with text fallback
```

**Navigation sections**: MAIN (Dashboard, Journal, Documents) · MOTU (Agents, Intelligence, The Hub, Weekly Recaps) · OPERATIONS (Clients, Cron Jobs, API Usage, Workshop)

---

### Known limitations / not yet built

- **Documents and Intelligence use localStorage** — should migrate to the DB for persistence and to be accessible by the agent loop
- **Weekly Recaps use localStorage** — same
- **Workshop badge count** in sidebar only refreshes every 8s — fine for now
- **The agent loop only "thinks"** — it calls Ollama and logs the response, but cannot execute anything in the real world. That requires OpenClaw.
- **No sub-agent orchestration** — all tasks go to Motu (agent id=1). Sub-agents exist in the UI but the loop doesn't route tasks to them yet

---

### OpenClaw integration — what needs to be built

**What OpenClaw is in this context**: Claude Code CLI acting as the execution engine. Motu (via Ollama) reasons about a task and produces a plan. OpenClaw executes that plan — writes code, runs terminal commands, edits files, calls APIs via MCP servers.

**The full intended loop:**
```
Task queued (manual or cron)
    ↓
Agent loop picks it up
    ↓
Ollama reasons: produces a structured plan (JSON)
    ↓
OpenClaw receives the plan
    ↓
OpenClaw executes: writes code / runs commands / calls MCP tools
    ↓
OpenClaw reports result back to Motu
    ↓
Result logged to task activity_log
    ↓
Task marked complete, commit auto-created
```

**What needs to be built for OpenClaw integration:**

**1. Structured output from Ollama** (`agent-loop.ts`)
Currently Ollama returns free-text. For OpenClaw to act on it, the prompt needs to request structured JSON:
```json
{
  "plan": "description of what to do",
  "actions": [
    { "type": "write_file", "path": "src/foo.ts", "content": "..." },
    { "type": "run_command", "command": "npm install lodash" },
    { "type": "call_mcp", "server": "gmail", "tool": "send_email", "args": {...} }
  ]
}
```

**2. OpenClaw bridge** (`src/main/openclaw.ts` — new file)
A module that takes the structured plan from Ollama and executes it by spawning Claude Code CLI as a child process:
```typescript
import { spawn } from 'child_process'

export async function executeWithOpenClaw(plan: string, taskId: number): Promise<string> {
  // Spawn: claude --print "execute this plan: {plan}"
  // Capture stdout for the activity log
  // Stream progress back to the task
}
```

**3. Task execution settings**
New settings needed:
- `openclaw_enabled` — toggle whether tasks go through OpenClaw or stay as Ollama-only reasoning
- `openclaw_path` — path to the `claude` CLI binary
- `openclaw_working_dir` — where OpenClaw executes (likely the project repo path)
- `openclaw_allowed_actions` — whitelist of action types (write_file, run_command, etc.)

These should be added to the settings table and exposed in `ApiUsage.tsx` as a new "OpenClaw Settings" section.

**4. MCP server wiring**
The user already has Gmail and Google Calendar MCP servers connected to Claude.ai. For OpenClaw to use these on behalf of Motu:
- When spawning OpenClaw, pass `--mcp-config` pointing to a config file listing available MCP servers
- The Ollama prompt needs to know which MCP tools are available so it can plan actions using them
- A new endpoint `GET /api/mcp/available` that returns the configured MCP servers

**5. Safety controls**
Before OpenClaw executes anything, the app needs:
- A confirmation step for destructive actions (deleting files, sending emails, running arbitrary commands)
- A dry-run mode that logs planned actions without executing
- A `max_actions_per_task` limit
- Optionally: human-in-the-loop approval for tasks above a certain risk threshold

**6. Sub-agent routing**
Currently all tasks go to Motu (id=1). With OpenClaw, different agents should execute different task types:
- Add `agent_capabilities` field to the agents table (JSON array of what the agent can do)
- Task creation should optionally specify required capabilities
- The agent loop should match tasks to capable agents, not just always pick Motu

**7. Result reporting back to the DB**
OpenClaw's stdout needs to be parsed and structured:
- Progress updates → appended to task `activity_log` in real time (websocket or polling)
- Final result → stored, task marked complete
- Errors → task re-queued or marked failed (new `failed` status needed)

**8. New task status: `failed`**
Currently: queued → active → completed. Need:
queued → active → completed | failed

Failed tasks should show in the kanban, be retryable, and have their error logged.

---

### Immediate next steps (priority order)

1. Add `failed` task status to DB schema and update all UI references
2. Build `src/main/openclaw.ts` bridge module
3. Add OpenClaw settings to `settings` table and `ApiUsage.tsx`
4. Update `agent-loop.ts` to use structured JSON prompts and route to OpenClaw
5. Add real-time activity log streaming (currently only updated when task completes)
6. Implement sub-agent routing based on capabilities
7. Wire MCP config for Gmail/Calendar so cron jobs like "check email" actually work