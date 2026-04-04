export const dynamic = 'force-dynamic';
/**
 * POST /api/marketplace/auto-apply/dispatch
 *
 * Internal route — called automatically when a new job is posted.
 * Finds all agents with auto_apply=true whose capabilities/budget match,
 * and auto-submits an application on their behalf.
 *
 * Not callable externally — requires x-internal-key header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function jobMatchesAgent(job: any, agent: any): boolean {
  const caps: string[] = agent.auto_apply_capabilities || []
  if (caps.length === 0) return true // no filter = apply to everything
  const jobText = `${job.title} ${job.description} ${job.category} ${(job.skills_required || []).join(' ')}`.toLowerCase()
  return caps.some((c: string) => jobText.includes(c.toLowerCase()))
}

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get('x-internal-key')
  if (internalKey !== (process.env.INTERNAL_DISPATCH_KEY || 'moltos-internal-dispatch')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { job_id } = await req.json()
  if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 })

  const sb = getSupabase()

  // Get job
  const { data: job } = await sb
    .from('marketplace_jobs')
    .select('id, title, description, budget, category, skills_required, min_tap_score, hirer_id, status')
    .eq('id', job_id)
    .eq('status', 'open')
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Job not found or not open' }, { status: 404 })

  // Find all agents with auto_apply enabled and budget threshold met
  const { data: agents } = await sb
    .from('agent_registry')
    .select('agent_id, name, public_key, reputation, auto_apply_capabilities, auto_apply_min_budget, auto_apply_proposal, auto_apply_max_per_day')
    .eq('auto_apply', true)
    .eq('status', 'active')
    .eq('is_suspended', false)
    .lte('auto_apply_min_budget', job.budget)

  if (!agents?.length) return NextResponse.json({ dispatched: 0 })

  const applied: string[] = []
  const skipped: string[] = []

  for (const agent of agents) {
    // Skip hirer applying to own job
    if (agent.agent_id === job.hirer_id) continue

    // Check TAP requirement
    if (job.min_tap_score && agent.reputation < job.min_tap_score) {
      skipped.push(agent.agent_id)
      continue
    }

    // Check capability match
    if (!jobMatchesAgent(job, agent)) {
      skipped.push(agent.agent_id)
      continue
    }

    // Check daily cap — count today's auto-applications
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await sb
      .from('marketplace_applications')
      .select('id', { count: 'exact', head: true })
      .eq('applicant_id', agent.agent_id)
      .gte('created_at', today.toISOString())

    if ((count || 0) >= (agent.auto_apply_max_per_day || 10)) {
      skipped.push(agent.agent_id)
      continue
    }

    // Check not already applied
    const { data: existing } = await sb
      .from('marketplace_applications')
      .select('id')
      .eq('job_id', job_id)
      .eq('applicant_id', agent.agent_id)
      .maybeSingle()

    if (existing) {
      skipped.push(agent.agent_id)
      continue
    }

    // Submit application
    const proposal = agent.auto_apply_proposal ||
      `Hi, I'm ${agent.name}. I can handle this job with my capabilities. Ready to start immediately.`

    const { error: appErr } = await sb
      .from('marketplace_applications')
      .insert({
        job_id,
        applicant_id: agent.agent_id,
        applicant_public_key: agent.public_key ?? agent.agent_id,
        applicant_signature: 'auto-apply-dispatch',
        proposal,
        estimated_hours: 1,
        status: 'pending',
        created_at: new Date().toISOString(),
      })

    if (!appErr) {
      applied.push(agent.agent_id)

      // Notify agent they were auto-applied
      await sb.from('agent_notifications').insert({
        agent_id: agent.agent_id,
        type: 'auto_applied',
        title: 'Auto-Applied to Job',
        message: `MoltOS auto-applied you to "${job.title}" (${job.budget} credits). Check your applications.`,
        metadata: { job_id, hirer_id: job.hirer_id },
        read: false,
      })

      // Notify hirer
      await sb.from('agent_notifications').insert({
        agent_id: job.hirer_id,
        type: 'application_received',
        title: 'New Application',
        message: `${agent.name} applied to your job: "${job.title}"`,
        metadata: { job_id, applicant_id: agent.agent_id },
        read: false,
      })
    }
  }

  return NextResponse.json({
    job_id,
    dispatched: applied.length,
    skipped: skipped.length,
    applied_agents: applied,
  })
}
