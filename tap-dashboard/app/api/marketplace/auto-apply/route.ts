/**
 * POST /api/marketplace/auto-apply
 *
 * Scan the marketplace and auto-apply to all matching jobs in one call.
 * The SDK's polling loop calls this; it can also be called once from a cron.
 *
 * Body: {
 *   filters: { min_budget?, max_budget?, keywords?, category?, max_tap_required? },
 *   proposal: string,             // proposal text to submit for each application
 *   estimated_hours?: number,     // default 1
 *   max_applications?: number,    // cap per call (default 5, max 20)
 *   dry_run?: boolean,            // preview matches without applying
 * }
 *
 * Returns: { applied: Job[], skipped: Job[], dry_run: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry')
    .select('agent_id, name, reputation, public_key, api_key_hash')
    .eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    filters?: { min_budget?: number; max_budget?: number; keywords?: string; category?: string; max_tap_required?: number }
    proposal?: string
    estimated_hours?: number
    max_applications?: number
    dry_run?: boolean
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const {
    filters = {},
    proposal = `Hi, I'm ${agent.name}. I can handle this job efficiently with my current skill set.`,
    estimated_hours = 1,
    max_applications = 5,
    dry_run = false,
  } = body

  const cap = Math.min(max_applications, 20)

  // Fetch open jobs
  let query = (sb as any)
    .from('marketplace_jobs')
    .select('id, title, description, budget, category, min_tap_score, skills_required, hirer_id, status')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.min_budget) query = query.gte('budget', filters.min_budget)
  if (filters.max_budget) query = query.lte('budget', filters.max_budget)
  if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category)

  const { data: jobs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter client-side
  let matched = (jobs || []).filter((j: any) => {
    if (j.hirer_id === agent.agent_id) return false // skip own jobs
    if (filters.max_tap_required && j.min_tap_score > filters.max_tap_required) return false
    if (filters.keywords) {
      const kw = filters.keywords.toLowerCase()
      const text = `${j.title} ${j.description} ${(j.skills_required || []).join(' ')}`.toLowerCase()
      if (!text.includes(kw)) return false
    }
    return true
  })

  // Check which ones agent already applied to
  const { data: existingApps } = await (sb as any)
    .from('job_applications')
    .select('job_id')
    .eq('applicant_id', agent.agent_id)
    .in('job_id', matched.map((j: any) => j.id))

  const alreadyApplied = new Set((existingApps || []).map((a: any) => a.job_id))
  const newJobs = matched.filter((j: any) => !alreadyApplied.has(j.id))
  const toApply = newJobs.slice(0, cap)
  const skipped = matched.filter((j: any) => !toApply.find((t: any) => t.id === j.id))

  if (dry_run) {
    return NextResponse.json({
      dry_run: true,
      matched_count: matched.length,
      would_apply_count: toApply.length,
      already_applied_count: alreadyApplied.size,
      would_apply: toApply.map((j: any) => ({ id: j.id, title: j.title, budget: j.budget, category: j.category, min_tap_score: j.min_tap_score })),
      skipped: skipped.map((j: any) => ({ id: j.id, title: j.title, reason: alreadyApplied.has(j.id) ? 'Already applied' : 'Capped' })),
    })
  }

  // Apply to each job
  const applied: any[] = []
  const failed: any[] = []
  const timestamp = Date.now()

  for (const job of toApply) {
    try {
      const { data: app, error: appErr } = await (sb as any)
        .from('job_applications')
        .insert({
          job_id: job.id,
          applicant_id: agent.agent_id,
          applicant_public_key: agent.public_key ?? agent.agent_id,
          proposal,
          estimated_hours,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (appErr) {
        failed.push({ id: job.id, title: job.title, error: appErr.message })
      } else {
        applied.push({ id: job.id, title: job.title, budget: job.budget, application_id: app.id })
      }
    } catch (e: any) {
      failed.push({ id: job.id, title: job.title, error: e.message })
    }
  }

  return NextResponse.json({
    success: true,
    dry_run: false,
    applied_count: applied.length,
    failed_count: failed.length,
    skipped_count: skipped.length,
    already_applied_count: alreadyApplied.size,
    applied,
    failed,
    proposal_used: proposal,
    message: applied.length > 0
      ? `Applied to ${applied.length} job(s). ${failed.length > 0 ? `${failed.length} failed.` : ''}`
      : 'No new matching jobs found.',
  })
}
