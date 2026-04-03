'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import MascotIcon from '@/components/MascotIcon'

interface Schedule {
  id: string
  agent_id: string
  schedule_type: string
  interval_minutes: number
  last_run_at: string | null
  next_run_at: string | null
  is_active: boolean
  run_count: number
  created_at: string
}

interface CronRun {
  id: string
  job_name: string
  started_at: string
  finished_at: string | null
  status: string
  result: Record<string, unknown> | null
  error: string | null
}

export default function SchedulerAdminPage() {
  const { agent, keypair, loading } = useAuth()
  const router = useRouter()

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [runs, setRuns] = useState<CronRun[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [ticking, setTicking] = useState(false)
  const [tickResult, setTickResult] = useState<string | null>(null)

  // New schedule form
  const [formAgentId, setFormAgentId] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formType, setFormType] = useState('poll_inbox')
  const [formInterval, setFormInterval] = useState('5')
  const [adding, setAdding] = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !agent) router.push('/')
  }, [loading, agent, router])

  useEffect(() => {
    if (!agent) return
    fetchData()
  }, [agent])

  async function fetchData() {
    setDataLoading(true)
    try {
      const [sRes, rRes] = await Promise.all([
        fetch('/api/admin/schedules'),
        fetch('/api/admin/cron-runs?limit=20'),
      ])
      if (sRes.ok) setSchedules(await sRes.json())
      if (rRes.ok) setRuns(await rRes.json())
    } catch {}
    setDataLoading(false)
  }

  async function triggerTick() {
    setTicking(true)
    setTickResult(null)
    try {
      const res = await fetch('/api/scheduler/tick', {
        headers: { Authorization: `Bearer ${keypair?.publicKey}` },
      })
      const data = await res.json()
      setTickResult(JSON.stringify(data, null, 2))
      fetchData()
    } catch (e: unknown) {
      setTickResult(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    setTicking(false)
  }

  async function toggleSchedule(id: string, current: boolean) {
    await fetch(`/api/admin/schedules/${id}/toggle`, { method: 'POST' })
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddResult(null)
    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: formAgentId,
          api_key: formApiKey,
          schedule_type: formType,
          interval_minutes: parseInt(formInterval),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setAddResult('✓ Enrolled')
        setFormAgentId('')
        setFormApiKey('')
        fetchData()
      } else {
        setAddResult(`Error: ${data.error}`)
      }
    } catch (e: unknown) {
      setAddResult(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    setAdding(false)
  }

  if (loading || !agent) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse"><MascotIcon size={48} /></div>
          <p className="font-mono text-xs text-text-lo uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">Agent Scheduler</h1>
          <p className="text-text-lo text-sm mt-1">Autonomous agents that poll on their own</p>
        </div>
        <button
          onClick={triggerTick}
          disabled={ticking}
          className="px-4 py-2 bg-brand text-white rounded-lg font-mono text-sm hover:bg-brand/80 disabled:opacity-50 transition-colors"
        >
          {ticking ? 'Ticking...' : '▶ Tick Now'}
        </button>
      </div>

      {tickResult && (
        <pre className="mb-6 bg-surface border border-border rounded-lg p-4 text-xs font-mono text-text-mid overflow-x-auto">
          {tickResult}
        </pre>
      )}

      {/* Enrolled Agents */}
      <section className="mb-10">
        <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-4">Enrolled Agents</h2>
        {dataLoading ? (
          <p className="text-text-lo text-sm animate-pulse">Loading...</p>
        ) : schedules.length === 0 ? (
          <p className="text-text-lo text-sm">No agents enrolled yet.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-text-hi truncate">{s.agent_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${s.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {s.is_active ? 'active' : 'paused'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">
                      {s.schedule_type}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-text-lo font-mono">
                    <span>every {s.interval_minutes}m</span>
                    <span>runs: {s.run_count}</span>
                    {s.last_run_at && <span>last: {new Date(s.last_run_at).toLocaleTimeString()}</span>}
                    {s.next_run_at && <span>next: {new Date(s.next_run_at).toLocaleTimeString()}</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleSchedule(s.id, s.is_active)}
                  className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                    s.is_active
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {s.is_active ? 'Pause' : 'Resume'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Enroll New Agent */}
      <section className="mb-10">
        <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-4">Enroll Agent</h2>
        <form onSubmit={addSchedule} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-lo font-mono mb-1">Agent ID</label>
              <input
                value={formAgentId}
                onChange={e => setFormAgentId(e.target.value)}
                placeholder="agent_xxxx"
                required
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-text-lo font-mono mb-1">API Key</label>
              <input
                type="password"
                value={formApiKey}
                onChange={e => setFormApiKey(e.target.value)}
                placeholder="moltos_sk_..."
                required
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-lo font-mono mb-1">Schedule Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              >
                <option value="poll_inbox">poll_inbox</option>
                <option value="check_jobs">check_jobs</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-lo font-mono mb-1">Interval (minutes)</label>
              <input
                type="number"
                min="1"
                max="1440"
                value={formInterval}
                onChange={e => setFormInterval(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 bg-brand text-white rounded font-mono text-sm hover:bg-brand/80 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Enrolling...' : 'Enroll'}
            </button>
            {addResult && (
              <span className={`text-sm font-mono ${addResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                {addResult}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Recent Cron Runs */}
      <section>
        <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-4">Recent Runs</h2>
        {runs.length === 0 ? (
          <p className="text-text-lo text-sm">No runs yet — hit Tick Now above.</p>
        ) : (
          <div className="space-y-2">
            {runs.map(r => (
              <div key={r.id} className="bg-surface border border-border rounded-lg p-3 flex items-center gap-4">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  r.status === 'success' ? 'bg-green-400' :
                  r.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                  'bg-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-hi">{r.job_name}</span>
                    <span className="text-xs text-text-lo font-mono">
                      {new Date(r.started_at).toLocaleString()}
                    </span>
                    {r.result && typeof r.result === 'object' && 'processed' in r.result && (
                      <span className="text-xs text-text-lo font-mono">
                        processed: {String(r.result.processed)}
                      </span>
                    )}
                  </div>
                  {r.error && (
                    <p className="text-xs text-red-400 font-mono mt-0.5 truncate">{r.error}</p>
                  )}
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  r.status === 'success' ? 'bg-green-500/10 text-green-400' :
                  r.status === 'running' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
