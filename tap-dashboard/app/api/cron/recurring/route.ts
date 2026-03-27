/**
 * GET /api/cron/recurring
 *
 * Called by Vercel Cron every hour.
 * Finds recurring jobs whose next_run_at has passed, spawns new job instances.
 * If last agent performed well → preferred_agent_id set for direct re-hire.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== 'Bearer moltos-cron') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Find overdue recurring jobs
  const { data: dueJobs } = await (supabase as any)
    .from('marketplace_jobs')
    .select('*')
    .not('recurrence', 'is', null)
    .lte('next_run_at', now)
    .in('status', ['open', 'in_progress', 'completed'])
    .limit(50)

  if (!dueJobs?.length) {
    return NextResponse.json({ spawned: 0, message: 'No recurring jobs due' })
  }

  const spawned = []
  const failed = []

  for (const job of dueJobs) {
    try {
      const intervalHours = job.recurrence_interval || 24
      const nextRun = new Date(Date.now() + intervalHours * 60 * 60 * 1000)

      // Find last hired agent — did they complete successfully?
      const { data: lastContract } = await (supabase as any)
        .from('marketplace_contracts')
        .select('worker_id, status, rating')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const preferredAgent = lastContract?.status === 'completed' && (lastContract.rating || 5) >= 4
        ? lastContract.worker_id
        : null

      // Spawn new job instance
      const { data: newJob } = await (supabase as any)
        .from('marketplace_jobs')
        .insert({
          title: job.title,
          description: job.description,
          budget: job.budget,
          category: job.category,
          skills_required: job.skills_required,
          min_tap_score: job.min_tap_score,
          hirer_id: job.hirer_id,
          hirer_public_key: job.hirer_public_key,
          hirer_signature: 'recurring-spawn',
          status: 'open',
          auto_hire: job.auto_hire,
          auto_hire_min_tap: job.auto_hire_min_tap,
          bond_required: job.bond_required,
          parent_job_id: job.id,
          preferred_agent_id: preferredAgent,
        })
        .select()
        .single()

      // Update parent job's next_run_at and total_runs
      await (supabase as any)
        .from('marketplace_jobs')
        .update({
          next_run_at: nextRun.toISOString(),
          total_runs: (job.total_runs || 0) + 1,
          last_hired_agent: preferredAgent || job.last_hired_agent,
        })
        .eq('id', job.id)

      // Trigger auto-hire or dispatch on new job
      if (newJob) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'

        if (preferredAgent) {
          // Direct dispatch to preferred agent
          await fetch(`${appUrl}/api/marketplace/jobs/${newJob.id}/auto-hire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-key': 'moltos-internal-dispatch' },
            body: JSON.stringify({ preferred_agent_id: preferredAgent }),
          }).catch(() => {})
        } else if (job.auto_hire) {
          await fetch(`${appUrl}/api/webhook-agent/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-key': 'moltos-internal-dispatch' },
            body: JSON.stringify({ job_id: newJob.id }),
          }).catch(() => {})
        }

        spawned.push({ parent_job_id: job.id, new_job_id: newJob.id, preferred_agent: preferredAgent })
      }
    } catch (err: any) {
      failed.push({ job_id: job.id, error: err.message })
    }
  }

  // Log cron run
  await (supabase as any).from('cron_runs').insert({
    job_name: 'recurring-jobs',
    finished_at: new Date().toISOString(),
    status: 'success',
    result: { spawned: spawned.length, failed: failed.length },
  })

  return NextResponse.json({ spawned: spawned.length, failed: failed.length, jobs: spawned })
}
