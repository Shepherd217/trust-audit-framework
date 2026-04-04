export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

let _sb: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  return _sb
}
const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get: (_target, prop) => (getSupabase() as any)[prop],
})

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://moltos.xyz'

// Vercel cron calls this every 5 minutes
// Also callable manually with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Vercel cron sends this automatically — also allow internal calls without secret (Vercel sets x-vercel-cron)
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const runId = crypto.randomUUID()
  const startedAt = new Date().toISOString()

  // Log start
  await supabase.from('cron_runs').insert({
    id: runId,
    job_name: 'scheduler_tick',
    started_at: startedAt,
    status: 'running',
  })

  const results: Record<string, unknown>[] = []
  let processed = 0
  let errors = 0

  try {
    // Fetch all due schedules
    const { data: schedules, error: fetchErr } = await supabase
      .from('agent_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString())

    if (fetchErr) throw fetchErr

    for (const schedule of schedules ?? []) {
      const result = await runSchedule(schedule)
      results.push({ agent_id: schedule.agent_id, ...result })
      if (result.error) errors++
      else processed++

      // Update schedule timing
      const nextRun = new Date(Date.now() + schedule.interval_minutes * 60 * 1000).toISOString()
      await supabase
        .from('agent_schedules')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun,
          run_count: schedule.run_count + 1,
        })
        .eq('id', schedule.id)
    }

    // Log completion
    await supabase.from('cron_runs').update({
      finished_at: new Date().toISOString(),
      status: 'success',
      result: { processed, errors, results },
    }).eq('id', runId)

    return NextResponse.json({ ok: true, processed, errors, results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('cron_runs').update({
      finished_at: new Date().toISOString(),
      status: 'error',
      error: msg,
    }).eq('id', runId)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

async function runSchedule(schedule: {
  id: string
  agent_id: string
  api_key: string
  schedule_type: string
}) {
  try {
    if (schedule.schedule_type === 'poll_inbox') {
      return await pollInbox(schedule.agent_id, schedule.api_key)
    }
    if (schedule.schedule_type === 'check_jobs') {
      return await checkJobs(schedule.agent_id, schedule.api_key)
    }
    return { skipped: true, reason: `unknown schedule_type: ${schedule.schedule_type}` }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// Poll agent inbox for unread messages, auto-process known message types
async function pollInbox(agentId: string, apiKey: string) {
  // Use the claw/bus/inbox endpoint which accepts ?key= param
  const url = `${BASE_URL}/api/claw/bus/inbox?key=${encodeURIComponent(apiKey)}&status=pending&limit=20`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    return { error: `inbox fetch failed: ${res.status} ${text.slice(0, 200)}` }
  }

  const data = await res.json()
  const messages: Array<{
    message_id: string
    message_type: string
    payload: Record<string, unknown>
    status: string
  }> = data.messages ?? []

  const unread = messages.filter((m) => m.status === 'unread' || m.status === 'pending')
  const acted: string[] = []

  for (const msg of unread) {
    // Auto-view job on assignment
    if (msg.message_type === 'job.assigned') {
      const jobId = msg.payload?.job_id as string | undefined
      if (jobId) {
        await fetch(`${BASE_URL}/api/jobs/${jobId}/view?auth=${encodeURIComponent(apiKey)}`)
        acted.push(`viewed job ${jobId}`)
      }
    }

    // Auto-vote "for" on DAO proposals (conservative default — agents can override via custom scheduler)
    if (msg.message_type === 'dao.proposal.new') {
      const proposalId = msg.payload?.proposal_id as string | undefined
      if (proposalId) {
        const voteRes = await fetch(
          `${BASE_URL}/api/dao/vote?auth=${encodeURIComponent(apiKey)}&proposal_id=${proposalId}&vote=for`
        )
        if (voteRes.ok) {
          acted.push(`voted for proposal ${proposalId}`)
        } else {
          const errText = await voteRes.text()
          // Already voted or expired — not a real error, just skip
          acted.push(`vote skipped: ${errText.split('\n')[0]}`)
        }
      }
    }
  }

  return { inbox_count: messages.length, unread: unread.length, acted }
}

// Check for assigned jobs and process them
async function checkJobs(agentId: string, apiKey: string) {
  // Fetch jobs assigned to this agent
  const { data: jobs, error } = await supabase
    .from('job_listings')
    .select('id, title, status, assigned_to')
    .eq('assigned_to', agentId)
    .eq('status', 'in_progress')

  if (error) return { error: error.message }

  return { assigned_jobs: jobs?.length ?? 0, job_ids: jobs?.map((j) => j.id) }
}
