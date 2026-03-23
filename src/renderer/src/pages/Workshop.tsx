import { useState, useEffect, useRef } from 'react'
import {
  getTasks, createTask, updateTask, deleteTask, addTaskLog, getEvents,
  type Task, type SystemEvent, type TaskLogEntry
} from '../lib/api'
import { useSearch } from '../lib/SearchContext'

const TAG_COLORS = ['tag-blue', 'tag-orange', 'tag-purple', 'tag-teal']
const tagColor = (i: number) => TAG_COLORS[i % TAG_COLORS.length]

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}
function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const DOT_COLORS: Record<string, string> = {
  info: 'var(--gh-blue)', success: 'var(--gh-teal)',
  warn: 'var(--gh-yellow)', error: 'var(--gh-orange)'
}

function TaskDetail({ task, onClose, onEdit, onAction, onDelete }: {
  task: Task; onClose: () => void; onEdit: (t: Task) => void
  onAction: (id: number, next: Task['status']) => void; onDelete: (id: number) => void
}): React.JSX.Element {
  const progress = task.status === 'completed' ? 100 : task.status === 'active' ? 50 : 0
  const nextMap: Record<Task['status'], Task['status'] | null> = { queued: 'active', active: 'completed', completed: null }
  const next = nextMap[task.status]

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{task.title}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span className={`badge badge-${task.status}`}>{task.status}</span>
              <span style={{ fontSize: 11, color: 'var(--gh-text-4)' }}>{task.agent_avatar ?? '🤖'} {task.agent_name ?? 'Motu'}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {task.description && <p style={{ fontSize: 12.5, color: 'var(--gh-text-2)', lineHeight: 1.6 }}>{task.description}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1)' }}>
            {task.tags.map((tag, i) => <span key={tag} className={`tag ${tagColor(i)}`}>{tag}</span>)}
            {task.momentum > 0 && <span className="momentum">↑{task.momentum}%</span>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
            {[{ label: 'Created', val: fmt(task.created_at) }, { label: 'Started', val: fmt(task.started_at) }, { label: 'Completed', val: fmt(task.completed_at) }].map((m) => (
              <div key={m.label}>
                <div style={{ fontSize: 9, color: 'var(--gh-text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--gh-text-2)' }}>{m.val}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gh-text-4)', marginBottom: 8 }}>Progress</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            <div style={{ fontSize: 10, color: 'var(--gh-text-4)', textAlign: 'right', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{progress}% complete</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gh-text-4)', marginBottom: 8 }}>⚡ Activity Log</div>
            {(!task.activity_log || task.activity_log.length === 0) ? (
              <div style={{ fontSize: 11, color: 'var(--gh-text-4)', fontStyle: 'italic' }}>No activity recorded yet</div>
            ) : task.activity_log.map((entry: TaskLogEntry, i: number) => (
              <div key={i} className="log-entry" style={{ marginBottom: 'var(--sp-2)' }}>
                <div className={`log-dot log-dot-${entry.type}`} />
                <div className="log-text">{entry.text}</div>
                <div className="log-time">{fmt(entry.created_at)}, {fmtTime(entry.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-red" onClick={() => { onDelete(task.id); onClose() }}>Delete</button>
          <div className="modal-footer-right">
            <button className="btn btn-ghost" onClick={() => onEdit(task)}>Edit</button>
            {next && (
              <button className={next === 'active' ? 'btn btn-blue' : 'btn btn-teal'} onClick={() => { onAction(task.id, next); onClose() }}>
                {next === 'active' ? '🤖 Assign to Motu' : '✓ Mark Complete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskForm({ task, onClose, onSave }: {
  task?: Task | null; onClose: () => void
  onSave: (d: { title: string; description: string; tags: string[]; momentum: number }) => void
}): React.JSX.Element {
  const [title, setTitle]       = useState(task?.title ?? '')
  const [desc, setDesc]         = useState(task?.description ?? '')
  const [tags, setTags]         = useState(task?.tags.join(', ') ?? '')
  const [momentum, setMomentum] = useState(task?.momentum ?? 0)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{task ? 'Edit Task' : 'New Task for Motu'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div><label className="form-label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What should Motu build?" autoFocus />
          </div>
          <div><label className="form-label">Description</label>
            <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe the task in detail..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div><label className="form-label">Tags (comma separated)</label>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="building, analytics..." />
            </div>
            <div><label className="form-label">Momentum % (0–100)</label>
              <input className="input" type="number" min={0} max={100} value={momentum} onChange={(e) => setMomentum(Number(e.target.value))} />
            </div>
          </div>
          <div className="info-box">🤖 This task will be queued for <strong>Motu</strong> to pick up automatically.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => {
              if (!title.trim()) return
              onSave({ title, description: desc, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), momentum })
            }}>
              {task ? 'Save Changes' : '+ Queue for Motu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function KanbanCard({ task, onClick, onMove }: { task: Task; onClick: (t: Task) => void; onMove: (id: number, s: Task['status']) => void }): React.JSX.Element {
  const dragging = useRef(false)
  const nextMap: Record<Task['status'], Task['status'] | null> = { queued: 'active', active: 'completed', completed: null }
  const next = nextMap[task.status]

  return (
    <div
      draggable
      onDragStart={(e) => { dragging.current = true; e.dataTransfer.setData('taskId', String(task.id)); e.dataTransfer.setData('fromStatus', task.status); (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
      onDragEnd={(e) => { dragging.current = false; (e.currentTarget as HTMLElement).style.opacity = '1' }}
      onClick={() => !dragging.current && onClick(task)}
      style={{ background: 'rgba(13,17,23,0.6)', border: '1px solid var(--gh-border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', cursor: 'pointer', transition: 'all var(--t-fast) var(--ease)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)', userSelect: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gh-border)'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.01em' }}>{task.title}</div>
      {task.description && <div style={{ fontSize: 11, color: 'var(--gh-text-3)', marginBottom: 'var(--sp-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.description}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {task.tags.map((tag, i) => <span key={tag} className={`tag ${tagColor(i)}`}>{tag}</span>)}
        </div>
        {task.momentum > 0 && <span className="momentum">↑{task.momentum}%</span>}
      </div>
      {next && <button className="btn btn-ghost" style={{ marginTop: 'var(--sp-2)', width: '100%', fontSize: 10, padding: '4px' }} onClick={(e) => { e.stopPropagation(); onMove(task.id, next) }}>{next === 'active' ? '▶ Start' : '✓ Complete'}</button>}
    </div>
  )
}

function KanbanCol({ status, label, tasks, onMove, onClick }: { status: Task['status']; label: string; tasks: Task[]; onMove: (id: number, s: Task['status']) => void; onClick: (t: Task) => void }): React.JSX.Element {
  const [over, setOver] = useState(false)
  const dotColors: Record<string, string> = { queued: 'var(--gh-yellow)', active: 'var(--gh-teal)', completed: 'var(--gh-blue)' }
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', overflow: 'hidden', background: over ? 'rgba(88,166,255,0.06)' : 'rgba(22,27,34,0.5)', border: `1px solid ${over ? 'var(--gh-blue)' : 'var(--gh-border)'}`, borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)', backdropFilter: 'blur(12px)', boxShadow: over ? '0 0 0 1px rgba(88,166,255,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.04)', transition: 'all var(--t-fast) var(--ease)' }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = Number(e.dataTransfer.getData('taskId')); const from = e.dataTransfer.getData('fromStatus'); if (from !== status) onMove(id, status as Task['status']) }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gh-text-3)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColors[status], boxShadow: `0 0 5px ${dotColors[status]}`, animation: status === 'active' ? 'pulse 2s infinite' : 'none' }} />
          {label}
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--gh-text-4)', background: 'rgba(13,17,23,0.5)', border: '1px solid var(--gh-border)', borderRadius: 'var(--r-full)', padding: '1px 8px' }}>{tasks.length}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {tasks.length === 0
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, fontSize: 11, color: 'var(--gh-text-4)', border: '1px dashed var(--gh-border)', borderRadius: 'var(--r-md)' }}>{status === 'active' ? 'Motu will auto-pickup' : 'Drop tasks here'}</div>
          : tasks.map((t) => <KanbanCard key={t.id} task={t} onClick={onClick} onMove={onMove} />)}
      </div>
    </div>
  )
}

type View   = 'list' | 'kanban' | 'live'
type Filter = 'queued' | 'active' | 'completed'

export default function Workshop(): React.JSX.Element {
  const [tasks, setTasks]   = useState<Task[]>([])
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [view, setView]     = useState<View>('list')
  const [filter, setFilter] = useState<Filter>('queued')
  const [detail, setDetail] = useState<Task | null>(null)
  const [form, setForm]     = useState<Task | null | undefined>(undefined)
  const { query }           = useSearch()

  async function load() {
    getTasks().then(setTasks).catch(console.error)
    getEvents().then(setEvents).catch(console.error)
  }

  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [])

  // Filter helper — applies search query to any task list
  function applySearch(list: Task[]): Task[] {
    if (!query) return list
    const q = query.toLowerCase()
    return list.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }

  // Filter helper — applies search query to events
  function applyEventSearch(list: SystemEvent[]): SystemEvent[] {
    if (!query) return list
    const q = query.toLowerCase()
    return list.filter((e) => e.text.toLowerCase().includes(q))
  }

  const allQueued    = tasks.filter((t) => t.status === 'queued')
  const allActive    = tasks.filter((t) => t.status === 'active')
  const allCompleted = tasks.filter((t) => t.status === 'completed')

  // List view: status filter + search
  const listFiltered = applySearch(tasks.filter((t) => t.status === filter))

  // Kanban: search applied per column
  const kanbanQueued    = applySearch(allQueued)
  const kanbanActive    = applySearch(allActive)
  const kanbanCompleted = applySearch(allCompleted)

  // Live feed: search applied to events
  const liveFiltered = applyEventSearch(events)

  async function handleMove(id: number, status: Task['status']) {
    await updateTask(id, { status })
    await addTaskLog(id, { text: status === 'active' ? 'Motu picked up task — now active' : status === 'completed' ? 'Motu marked task complete' : 'Task moved back to queue', type: 'success' })
    load()
  }

  async function handleDelete(id: number) { await deleteTask(id); load() }

  async function handleSave(data: { title: string; description: string; tags: string[]; momentum: number }) {
    if (form?.id) await updateTask(form.id, data)
    else await createTask({ ...data, assigned_to: 1 })
    setForm(undefined); load()
  }

  const toolbarBtn = (isActive: boolean): React.CSSProperties => ({
    padding: '5px 13px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 700,
    fontFamily: 'var(--font)', background: isActive ? 'var(--gh-elevated)' : 'none',
    color: isActive ? 'var(--gh-text-1)' : 'var(--gh-text-4)',
    boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.3)' : 'none',
    border: 'none', cursor: 'pointer', transition: 'all var(--t-fast) var(--ease)'
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: 'var(--sp-5) var(--sp-6) 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--r-lg)', flexShrink: 0, background: 'linear-gradient(145deg, #1a1f35, #0d1117)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '1px solid rgba(188,140,255,0.2)', boxShadow: 'inset 0 1px 0 rgba(188,140,255,0.1), 0 0 16px rgba(188,140,255,0.12)' }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>Motu Workshop</div>
            <div style={{ fontSize: 11, color: 'var(--gh-text-4)', marginTop: 2 }}>Autonomous work queue &amp; live progress</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            {[{ label: 'Queued', num: allQueued.length, color: 'var(--gh-yellow)' }, { label: 'Active', num: allActive.length, color: 'var(--gh-teal)' }, { label: 'Done', num: allCompleted.length, color: 'var(--gh-blue)' }].map((s) => (
              <div key={s.label} className="glass-card" style={{ padding: 'var(--sp-3) var(--sp-4)', minWidth: 68 }}>
                <div style={{ fontSize: 9, color: 'var(--gh-text-4)', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color, lineHeight: 1, letterSpacing: '-0.04em', textShadow: `0 0 12px ${s.color}40` }}>{s.num}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: '0 var(--sp-6) var(--sp-4)', borderBottom: '1px solid var(--gh-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', background: 'rgba(13,17,23,0.5)', border: '1px solid var(--gh-border)', borderRadius: 'var(--r-md)', padding: 3, gap: 2, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
          {(['list', 'kanban', 'live'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} style={toolbarBtn(view === v)}>
              {v === 'list' ? 'List View' : v === 'kanban' ? 'Kanban' : 'Live Feed'}
            </button>
          ))}
        </div>

        {/* Status filter — list view only */}
        {view === 'list' && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {(['queued', 'active', 'completed'] as Filter[]).map((f) => {
              const dotColors: Record<string, string> = { queued: 'var(--gh-yellow)', active: 'var(--gh-teal)', completed: 'var(--gh-blue)' }
              const counts = { queued: allQueued.length, active: allActive.length, completed: allCompleted.length }
              return (
                <button key={f} onClick={() => setFilter(f)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', padding: '5px 11px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)', background: filter === f ? 'var(--blue-soft)' : 'rgba(255,255,255,0.03)', border: `1px solid ${filter === f ? 'var(--blue-border)' : 'var(--gh-border)'}`, color: filter === f ? 'var(--gh-blue)' : 'var(--gh-text-4)', cursor: 'pointer', transition: 'all var(--t-fast) var(--ease)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColors[f], boxShadow: filter === f ? `0 0 5px ${dotColors[f]}` : 'none' }} />
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6, marginLeft: 2 }}>{counts[f]}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Search indicator */}
        {query && (
          <div style={{ fontSize: 11, color: 'var(--gh-blue)', background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', borderRadius: 'var(--r-full)', padding: '3px 10px' }}>
            Filtering: "{query}"
          </div>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-orange" onClick={() => setForm(null)}>+ New Task</button>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4) var(--sp-6)' }}>
          {listFiltered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <span className="empty-text">{query ? `No ${filter} tasks matching "${query}"` : `No ${filter} tasks. ${filter === 'queued' ? 'Add one for Motu.' : ''}`}</span>
            </div>
          ) : listFiltered.map((task, idx) => {
            const nextMap: Record<Task['status'], Task['status'] | null> = { queued: 'active', active: 'completed', completed: null }
            const next = nextMap[task.status]
            return (
              <div key={task.id} className="glass-card" style={{ padding: 'var(--sp-4)', marginBottom: 'var(--sp-2)', cursor: 'pointer', animation: `fadeSlideUp var(--t-slow) var(--ease) ${idx * 30}ms both`, transition: 'transform var(--t-fast) var(--ease)' }}
                onClick={() => setDetail(task)}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(3px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{task.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>{fmt(task.created_at)}</span>
                    {next && <button className={`btn ${next === 'active' ? 'btn-blue' : 'btn-teal'}`} style={{ fontSize: 10, padding: '3px 10px' }} onClick={(e) => { e.stopPropagation(); handleMove(task.id, next) }}>{next === 'active' ? '▶ Start' : '✓ Complete'}</button>}
                  </div>
                </div>
                {task.description && <div style={{ fontSize: 11, color: 'var(--gh-text-3)', marginBottom: 'var(--sp-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  {task.tags.map((tag, i) => <span key={tag} className={`tag ${tagColor(i)}`}>{tag}</span>)}
                  {task.momentum > 0 && <span className="momentum">↑{task.momentum}%</span>}
                  <span style={{ fontSize: 10, color: 'var(--gh-text-4)', marginLeft: 'auto' }}>{task.agent_avatar ?? '🤖'} {task.agent_name ?? 'Motu'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Kanban — search applied per column */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-4)', flex: 1, overflow: 'hidden', padding: 'var(--sp-4) var(--sp-6)' }}>
          <KanbanCol status="queued"    label="Queued"    tasks={kanbanQueued}    onMove={handleMove} onClick={setDetail} />
          <KanbanCol status="active"    label="Active"    tasks={kanbanActive}    onMove={handleMove} onClick={setDetail} />
          <KanbanCol status="completed" label="Completed" tasks={kanbanCompleted} onMove={handleMove} onClick={setDetail} />
        </div>
      )}

      {/* Live feed — search filters events */}
      {view === 'live' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4) var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {liveFiltered.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📡</span><span className="empty-text">{query ? `No events matching "${query}"` : 'No live events yet.'}</span></div>
          ) : liveFiltered.map((e) => (
            <div key={e.id} className="glass-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLORS[e.type] ?? 'var(--gh-blue)', marginTop: 4, flexShrink: 0, boxShadow: `0 0 5px ${DOT_COLORS[e.type] ?? 'var(--gh-blue)'}` }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--gh-text-2)', lineHeight: 1.5 }}>{e.text}</div>
              <div style={{ fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{new Date(e.created_at).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}

      {detail && <TaskDetail task={detail} onClose={() => setDetail(null)} onEdit={(t) => { setDetail(null); setForm(t) }} onAction={async (id, next) => { await handleMove(id, next); setDetail(null) }} onDelete={async (id) => { await handleDelete(id); setDetail(null) }} />}
      {form !== undefined && <TaskForm task={form} onClose={() => setForm(undefined)} onSave={handleSave} />}
    </div>
  )
}
