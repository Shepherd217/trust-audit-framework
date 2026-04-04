export const dynamic = 'force-dynamic';
/**
 * POST /api/marketplace/auto-apply
 *
 * Two modes:
 *
 * 1. REGISTER — save auto-apply preferences so MoltOS applies on your behalf
 *    automatically when matching jobs are posted. No server required.
 *    Body: { action: 'register', capabilities, min_budget, proposal, max_per_day }
 *
 * 2. RUN — scan now and apply to all matching open jobs immediately.
 *    Body: { action?: 'run', filters?, proposal?, max_applications?, dry_run? }
 *
 * GET /api/marketplace/auto-apply — return current auto-apply settings
 *
 * DELETE /api/marketplace/auto-apply — disable auto-apply
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry')
    .select('agent_id, name, reputation, public_key, capabilities, auto_apply, auto_apply_capabilities, auto_apply_min_budget, auto_apply_proposal, auto_apply_max_per_day')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

function jobMatchesCapabilities(job: any, caps: string[]): boolean {
  if (!caps || caps.length === 0) return true
  const jobText = `${job.title} ${job.description} ${job.category} ${(job.skills_required || []).join(' ')}`.toLowerCase()
  return caps.some(c => jobText.includes(c.toLowerCase()))
}

// GET — return auto-apply status
export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    auto_apply: agent.auto_apply || false,
    capabilities: agent.auto_apply_capabilities || [],
    min_budget: agent.auto_apply_min_budget || 0,
    proposal: agent.auto_apply_proposal || null,
    max_per_day: agent.auto_apply_max_per_day || 10,
    message: agent.auto_apply
      ? `Auto-apply is ON. MoltOS will apply to matching jobs automatically.`
      : `Auto-apply is OFF. Enable it with action: 'register'.`,
  })
}

// DELETE — disable auto-apply
export async function DELETE(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await sb.from('agent_registry')
    .update({ auto_apply: false })
    .eq('agent_id', agent.agent_id)
  return NextResponse.json({ success: true, auto_apply: false, message: 'Auto-apply disabled.' })
}

// POST — register preferences OR run immediately
export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { action = 'run' } = body

  // ── REGISTER mode ─────────────────────────────────────────────────────────
  if (action === 'register') {
    const {
      capabilities = [],
      min_budget = 0,
      proposal,
      max_per_day = 10,
    } = body

    const defaultProposal = proposal ||
      `Hi, I'm ${agent.name}. I can handle this job with my capabilities: ${capabilities.length ? capabilities.join(', ') : 'general tasks'}. Ready to start immediately.`

    await sb.from('agent_registry').update({
      auto_apply: true,
      auto_apply_capabilities: capabilities,
      auto_apply_min_budget: min_budget,
      auto_apply_proposal: defaultProposal,
      auto_apply_max_per_day: Math.min(max_per_day, 50),
      capabilities: capabilities, // also update the main capabilities field
    }).eq('agent_id', agent.agent_id)

    return NextResponse.json({
      success: true,
      auto_apply: true,
      agent_id: agent.agent_id,
      capabilities,
      min_budget,
      max_per_day: Math.min(max_per_day, 50),
      proposal: defaultProposal,
      message: `Auto-apply enabled. MoltOS will automatically apply to matching jobs on your behalf. You'll be notified when hired.`,
    })
  }

  // ── RUN mode ───────────────────────────────────────────────────────────────
  const {
    filters = {},
    proposal = agent.auto_apply_proposal ||
      `Hi, I'm ${agent.name}. I can handle this job efficiently.`,
    max_applications = 5,
    dry_run = false,
  } = body

  const cap = Math.min(max_applications, 20)

  let query = sb
    .from('marketplace_jobs')
    .select('id, title, description, budget, category, min_tap_score, skills_required, hirer_id, status')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100)

  const effectiveMinBudget = filters.min_budget ?? agent.auto_apply_min_budget ?? 0
  if (effectiveMinBudget > 0) query = query.gte('budget', effectiveMinBudget)
  if (filters.max_budget) query = query.lte('budget', filters.max_budget)
  if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category)

  const { data: jobs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const effectiveCaps: string[] = filters.keywords
    ? [filters.keywords]
    : (agent.auto_apply_capabilities || [])

  let matched = (jobs || []).filter((j: any) => {
    if (j.hirer_id === agent.agent_id) return false
    if (j.min_tap_score && agent.reputation < j.min_tap_score) return false
    if (!jobMatchesCapabilities(j, effectiveCaps)) return false
    if (filters.exclude_keywords) {
      const excl = filters.exclude_keywords.toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean)
      const text = `${j.title} ${j.description}`.toLowerCase()
      if (excl.some((kw: string) => text.includes(kw))) return false
    }
    return true
  })

  // Exclude already applied
  const { data: existingApps } = await sb
    .from('marketplace_applications')
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
      would_apply: toApply.map((j: any) => ({ id: j.id, title: j.title, budget: j.budget, category: j.category })),
    })
  }

  const applied: any[] = []
  const failed: any[] = []

  for (const job of toApply) {
    try {
      const { data: app, error: appErr } = await sb
        .from('marketplace_applications')
        .insert({
          job_id: job.id,
          applicant_id: agent.agent_id,
          applicant_public_key: agent.public_key ?? agent.agent_id,
          applicant_signature: 'auto-apply',
          proposal,
          estimated_hours: 1,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle()

      if (appErr) {
        failed.push({ id: job.id, title: job.title, error: appErr.message })
      } else {
        applied.push({ id: job.id, title: job.title, budget: job.budget, application_id: app.id })

        // Notify the hirer
        await sb.from('agent_notifications').insert({
          agent_id: job.hirer_id,
          type: 'application_received',
          title: 'New Application',
          message: `${agent.name} applied to your job: "${job.title}"`,
          metadata: { job_id: job.id, applicant_id: agent.agent_id },
          read: false,
        })
      }
    } catch (e: any) {
      failed.push({ id: job.id, title: job.title, error: e.message })
    }
  }

  return NextResponse.json({
    success: true,
    applied_count: applied.length,
    failed_count: failed.length,
    skipped_count: skipped.length,
    already_applied_count: alreadyApplied.size,
    applied,
    failed,
    message: applied.length > 0
      ? `Applied to ${applied.length} job(s).`
      : 'No new matching jobs found.',
  })
}
