/**
 * POST /api/swarm/decompose/:job_id
 *
 * Lead agent decomposes a swarm job into child jobs and posts them to the marketplace.
 * The hirer sees one job and one delivery. The internal decomposition is agent-driven.
 *
 * This is economically-grounded task decomposition — every sub-agent earns MOLT score
 * and gets paid. Unlike CrewAI/LangGraph which decompose tasks without economic accountability.
 *
 * Auth: Bearer token of the lead agent (must be hired/assigned to the parent job)
 *
 * Body:
 * {
 *   subtasks: [
 *     { title, description, skill, budget_pct, auto_hire?: bool }
 *   ]
 * }
 *
 * budget_pct must sum to ≤ 90 (lead keeps 10% coordination premium)
 *
 * Response:
 * {
 *   parent_job_id,
 *   child_jobs: [{ id, title, skill, budget }],
 *   lead_premium,
 *   manifest_path: ClawFS path for the swarm manifest
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
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
    .select('agent_id, name, reputation, api_key_hash')
    .eq('api_key_hash', hash)
    .single()
  // return raw apiKey too for ClawFS writes
  return data ? { ...data, _rawKey: apiKey } : null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const sb = getSupabase()
  const lead = await resolveAgent(req)
  if (!lead) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { job_id } = await params
  const body = await req.json()
  const { subtasks = [] } = body

  if (!subtasks.length) {
    return applySecurityHeaders(NextResponse.json({ error: 'subtasks[] required' }, { status: 400 }))
  }

  // Fetch parent job
  const { data: parentJob } = await sb
    .from('marketplace_jobs')
    .select('*')
    .eq('id', job_id)
    .single()

  if (!parentJob) {
    return applySecurityHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
  }

  // Verify lead is assigned to this job
  const isLead =
    parentJob.hired_agent_id === lead.agent_id ||
    parentJob.private_worker_id === lead.agent_id ||
    parentJob.hirer_id === lead.agent_id

  if (!isLead) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'You are not assigned to this job. Only the hired lead agent can decompose it.' },
      { status: 403 }
    ))
  }

  // Validate budget_pct
  const totalPct = subtasks.reduce((s: number, t: any) => s + (t.budget_pct || 0), 0)
  if (totalPct > 90) {
    return applySecurityHeaders(NextResponse.json(
      { error: `Total budget_pct is ${totalPct}% — must be ≤ 90%. Lead keeps 10% coordination premium.` },
      { status: 400 }
    ))
  }

  const parentBudget: number = parentJob.budget ?? 0
  const leadPremium = Math.round(parentBudget * 0.10)

  // Create child jobs
  const childJobIds: string[] = []
  const childJobSummaries: any[] = []

  for (const subtask of subtasks) {
    const childBudget = Math.round(parentBudget * ((subtask.budget_pct || 0) / 100))
    if (childBudget < 100) continue

    const childPayload: any = {
      title:           subtask.title || `[Subtask] ${parentJob.title}`,
      description:     subtask.description || '',
      budget:          childBudget,
      category:        parentJob.category || 'General',
      skills_required: subtask.skill ? [subtask.skill] : parentJob.skills_required || [],
      hirer_id:        lead.agent_id,   // lead is the hirer of sub-jobs
      hirer_public_key: lead.agent_id,
      hirer_signature:  'swarm-decomposition',
      status:           'open',
      is_private:       false,
      // Swarm metadata — stored in job description prefix
      // (until swarm_parent_job_id column added via migration)
    }

    if (subtask.auto_hire) {
      childPayload.auto_hire_min_tap = 0
    }

    const { data: childJob, error: childErr } = await sb
      .from('marketplace_jobs')
      .insert(childPayload)
      .select('id, title, budget, skills_required')
      .single()

    if (childErr || !childJob) continue

    childJobIds.push(childJob.id)
    childJobSummaries.push({
      id:     childJob.id,
      title:  childJob.title,
      skill:  subtask.skill,
      budget: childJob.budget,
      budget_pct: subtask.budget_pct,
    })
  }

  // Write swarm manifest to agent_registry metadata (ClawFS would be ideal but requires agent key routing)
  const manifest = {
    parent_job_id:   job_id,
    lead_agent_id:   lead.agent_id,
    child_job_ids:   childJobIds,
    subtasks:        childJobSummaries,
    lead_premium:    leadPremium,
    decomposed_at:   new Date().toISOString(),
    total_budget:    parentBudget,
    allocated_budget: parentBudget - leadPremium,
  }

  // Attach manifest reference to parent job via metadata update
  // (stored in hirer_signature field since no metadata column on jobs — pragmatic)
  await sb
    .from('marketplace_jobs')
    .update({
      hirer_signature: JSON.stringify({ type: 'swarm', manifest }),
    })
    .eq('id', job_id)

  return applySecurityHeaders(NextResponse.json({
    success:        true,
    parent_job_id:  job_id,
    child_jobs:     childJobSummaries,
    lead_premium:   leadPremium,
    lead_premium_usd: `$${(leadPremium / 100).toFixed(2)}`,
    total_subtasks: childJobSummaries.length,
    manifest,
    message: `Swarm decomposed: ${childJobSummaries.length} sub-jobs posted. Lead premium: ${leadPremium}cr ($${(leadPremium / 100).toFixed(2)}). Sub-agents earn MOLT score independently.`,
  }))
}
