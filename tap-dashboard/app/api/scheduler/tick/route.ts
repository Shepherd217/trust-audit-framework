export const dynamic = 'force-dynamic';
/**
 * GET /api/scheduler/tick
 *
 * Called by Vercel cron every 5 minutes.
 * Processes all active agent_schedules that are due to run.
 *
 * For each due schedule:
 *   1. Fetch agent's ClawBus inbox (pending job.assigned messages)
 *   2. For each unread job.assigned — call /api/jobs/[id]/view
 *   3. Mark ClawBus message as read
 *   4. Update schedule: last_run_at, next_run_at, run_count
 *
 * Protected by CRON_SECRET (Vercel sets Authorization: Bearer <secret>).
 * Also accepts ?secret=... for manual testing.
 *
 * Logs each tick to cron_runs table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
const CRON_SECRET = process.env.CRON_SECRET || ''

function db() {
  return createClient(SUPA_URL, SUPA_KEY)
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

/** Fetch pending job.assigned messages for an agent via internal DB query (no HTTP round-trip) */
async function getPendingJobMessages(agentId: string) {
  const { data, error } = await db()
    .from('clawbus_messages')
    .select('message_id, from_agent, payload, created_at')
    .eq('to_agent', agentId)
    .eq('message_type', 'job.assigned')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) throw new Error(`inbox query failed: ${error.message}`)
  return data ?? []
}

/** Mark a ClawBus message as read */
async function markRead(messageId: string) {
  await db()
    .from('clawbus_messages')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('message_id', messageId)
}

/** Call /api/jobs/[id]/view to trigger any side effects & confirm agent sees the job */
async function viewJob(jobId: string, apiKey: string): Promise<string> {
  try {
    const url = `${BASE_URL}/api/jobs/${jobId}/view?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, { method: 'GET' })
    const text = await res.text()
    return text.slice(0, 500) // cap output
  } catch (e) {
    return `fetch error: ${String(e)}`
  }
}

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization') || ''
  const secretParam = new URL(req.url).searchParams.get('secret') || ''
  const provided = authHeader.replace(/^Bearer\s+/i, '') || secretParam

  // Only enforce if CRON_SECRET is configured
  if (CRON_SECRET && provided !== CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const started = new Date().toISOString()
  const results: Array<{
    schedule_id: string
    agent_id: string
    messages_found: number
    jobs_viewed: string[]
    error?: string
  }> = []

  let runError: string | undefined

  try {
    // Fetch all due schedules
    const { data: schedules, error: schedErr } = await db()
      .from('agent_schedules')
      .select('id, agent_id, api_key, schedule_type, interval_minutes, run_count')
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(50)

    if (schedErr) throw new Error(`schedules query: ${schedErr.message}`)

    for (const sched of (schedules ?? [])) {
      const result: typeof results[0] = {
        schedule_id: sched.id,
        agent_id: sched.agent_id,
        messages_found: 0,
        jobs_viewed: [],
      }

      try {
        if (sched.schedule_type === 'poll_inbox' || sched.schedule_type === 'check_jobs') {
          // Get pending job.assigned messages
          const messages = await getPendingJobMessages(sched.agent_id)
          result.messages_found = messages.length

          for (const msg of messages) {
            const payload = msg.payload as Record<string, unknown>
            const jobId = payload?.job_id as string | undefined
            if (!jobId) continue

            // View the job (triggers any server-side side effects)
            const viewResult = await viewJob(jobId, sched.api_key)
            result.jobs_viewed.push(`${jobId}: ${viewResult.split('\n')[0]}`)

            // Mark message read
            await markRead(msg.message_id)
          }
        }

        // Update schedule timing
        const now = new Date()
        const nextRun = new Date(now.getTime() + sched.interval_minutes * 60 * 1000)
        await db()
          .from('agent_schedules')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
            run_count: (sched.run_count ?? 0) + 1,
          })
          .eq('id', sched.id)

      } catch (e) {
        result.error = String(e)
      }

      results.push(result)
    }

  } catch (e) {
    runError = String(e)
  }

  const finished = new Date().toISOString()
  const totalJobs = results.reduce((sum, r) => sum + r.jobs_viewed.length, 0)
  const summary = {
    schedules_processed: results.length,
    jobs_actioned: totalJobs,
    results,
    ...(runError ? { error: runError } : {}),
  }

  // Log to cron_runs
  await db().from('cron_runs').insert({
    job_name: 'scheduler.tick',
    started_at: started,
    finished_at: finished,
    status: runError ? 'error' : 'success',
    result: summary,
    error: runError ?? null,
  })

  return json({
    tick: started,
    ...summary,
  })
}
