import { useState, useEffect } from 'react'
import { getCronJobs, createCronJob, updateCronJob, deleteCronJob, type CronJob } from '../lib/api'
import { useSearch } from '../lib/SearchContext'

const PRESETS = [
  { label: 'Every hour',         value: '0 * * * *' },
  { label: 'Every day 8am',      value: '0 8 * * *' },
  { label: 'Every day midnight', value: '0 0 * * *' },
  { label: 'Every Monday',       value: '0 9 * * 1' },
  { label: 'Every 30 min',       value: '*/30 * * * *' }
]

function CronModal({ job, onClose, onSave }: {
  job?: CronJob | null; onClose: () => void
  onSave: (data: Partial<CronJob>) => void
}): React.JSX.Element {
  const [name, setName]         = useState(job?.name ?? '')
  const [schedule, setSchedule] = useState(job?.schedule ?? '0 8 * * *')
  const [desc, setDesc]         = useState(job?.description ?? '')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{job ? 'Edit Cron Job' : 'New Cron Job'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div><label className="form-label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name..." autoFocus /></div>
          <div>
            <label className="form-label">Schedule (cron expression)</label>
            <input className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 8 * * *" style={{ fontFamily: 'var(--font-mono)' }} />
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {PRESETS.map((p) => (
                <button key={p.value} className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setSchedule(p.value)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div><label className="form-label">Description</label><textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this job do?" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <div className="modal-footer-right">
            <button className="btn btn-orange" onClick={() => { if (!name.trim()) return; onSave({ name, schedule, description: desc }) }}>
              {job ? 'Save Changes' : 'Schedule Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CronJobs(): React.JSX.Element {
  const [jobs, setJobs]   = useState<CronJob[]>([])
  const [modal, setModal] = useState<CronJob | null | undefined>(undefined)
  const { query }         = useSearch()

  function load() { getCronJobs().then(setJobs).catch(console.error) }
  useEffect(() => { load() }, [])

  async function handleSave(data: Partial<CronJob>) {
    if (modal?.id) await updateCronJob(modal.id, data)
    else await createCronJob(data)
    setModal(undefined); load()
  }

  async function toggleEnabled(job: CronJob) {
    await updateCronJob(job.id, { enabled: job.enabled ? 0 : 1 }); load()
  }

  async function handleDelete(id: number) { await deleteCronJob(id); load() }

  const filtered = jobs.filter((j) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      j.name.toLowerCase().includes(q) ||
      (j.description ?? '').toLowerCase().includes(q) ||
      j.schedule.toLowerCase().includes(q)
    )
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Cron Jobs</div>
          <div className="page-subtitle">{filtered.length} job{filtered.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}</div>
        </div>
        <button className="btn btn-orange" onClick={() => setModal(null)}>+ New Job</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">◷</span>
          <span className="empty-text">{query ? `No jobs matching "${query}"` : 'No cron jobs yet. Schedule recurring tasks for Motu.'}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {filtered.map((job, idx) => (
            <div key={job.id} className={`glass-card anim-in-${Math.min(idx + 1, 4)}`} style={{ padding: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{job.name}</div>
                    <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--gh-blue)', background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>{job.schedule}</code>
                    <span style={{ fontSize: 10, fontWeight: 700, color: job.enabled ? 'var(--gh-teal)' : 'var(--gh-text-4)', background: job.enabled ? 'var(--teal-soft)' : 'rgba(255,255,255,0.04)', border: `1px solid ${job.enabled ? 'var(--teal-border)' : 'var(--gh-border)'}`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>
                      {job.enabled ? '● Enabled' : '○ Disabled'}
                    </span>
                  </div>
                  {job.description && <p style={{ fontSize: 11.5, color: 'var(--gh-text-2)', marginBottom: 'var(--sp-2)', lineHeight: 1.5 }}>{job.description}</p>}
                  <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: 10, color: 'var(--gh-text-4)', fontFamily: 'var(--font-mono)' }}>
                    {job.last_run && <span>Last: {new Date(job.last_run).toLocaleString()}</span>}
                    {job.next_run && <span>Next: {new Date(job.next_run).toLocaleString()}</span>}
                    <span>Created: {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  <button className={`btn ${job.enabled ? 'btn-ghost' : 'btn-teal'}`} style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => toggleEnabled(job)}>
                    {job.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setModal(job)}>Edit</button>
                  <button className="btn btn-red" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => handleDelete(job.id)}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== undefined && <CronModal job={modal} onClose={() => setModal(undefined)} onSave={handleSave} />}
    </div>
  )
}
