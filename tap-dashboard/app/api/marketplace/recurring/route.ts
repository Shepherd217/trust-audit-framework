/**
 * POST /api/marketplace/recurring — Create a recurring job
 * GET  /api/marketplace/recurring — List your recurring jobs
 * POST /api/marketplace/recurring/trigger — Internal: spawn next run
 *
 * Recurring jobs auto-repost on a schedule.
 * If the same agent completed last time and is still available → re-hire them directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

const RECURRENCE_HOURS: Record<string, number> = {
  hourly: 1, daily: 24, weekly: 168, monthly: 720,
}

// POST — create recurring job
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, budget, category, skills_required, min_tap_score,
          recurrence, auto_hire, auto_hire_min_tap, bond_required } = body

  if (!title || !budget || !recurrence) {
    return NextResponse.json({ error: 'title, budget, and recurrence required' }, { status: 400 })
  }
  if (!RECURRENCE_HOURS[recurrence]) {
    return NextResponse.json({ error: `recurrence must be one of: ${Object.keys(RECURRENCE_HOURS).join(', ')}` }, { status: 400 })
  }

  const intervalHours = RECURRENCE_HOURS[recurrence]
  const nextRun = new Date(Date.now() + intervalHours * 60 * 60 * 1000)

  const { data: job, error } = await (supabase as any)
    .from('marketplace_jobs')
    .insert({
      title, description, budget,
      category: category || 'General',
      skills_required: skills_required || [],
      min_tap_score: min_tap_score || 0,
      hirer_id: agentId,
      hirer_public_key: agentId,
      hirer_signature: 'recurring-job',
      status: 'open',
      auto_hire: auto_hire !== false,
      auto_hire_min_tap: auto_hire_min_tap || 0,
      recurrence,
      recurrence_interval: intervalHours,
      next_run_at: nextRun.toISOString(),
      bond_required: bond_required || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger initial auto-hire if enabled
  if (auto_hire !== false) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'
    fetch(`${appUrl}/api/marketplace/jobs/${job.id}/auto-hire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key') || '' },
      body: JSON.stringify({ min_tap: auto_hire_min_tap || 0 }),
    }).catch(() => {})
  }

  return NextResponse.json({
    success: true,
    job_id: job.id,
    recurrence,
    next_run_at: nextRun.toISOString(),
    interval_hours: intervalHours,
    auto_hire: auto_hire !== false,
    message: `Recurring job created. Runs every ${recurrence}. Auto-hire: ${auto_hire !== false}.`,
  })
}

// GET — list recurring jobs for this agent
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: jobs } = await (supabase as any)
    .from('marketplace_jobs')
    .select('id, title, budget, category, recurrence, next_run_at, total_runs, last_hired_agent, status, auto_hire, auto_hire_min_tap')
    .eq('hirer_id', agentId)
    .not('recurrence', 'is', null)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    recurring_jobs: jobs || [],
    count: (jobs || []).length,
  })
}
