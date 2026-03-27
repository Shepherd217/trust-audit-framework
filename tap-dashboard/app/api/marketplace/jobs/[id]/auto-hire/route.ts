/**
 * POST /api/marketplace/jobs/[id]/auto-hire
 *
 * Enable auto-hire on an existing job, OR the job post route calls this
 * automatically when auto_hire: true is set.
 *
 * Logic:
 *  1. Find all webhook agents whose capabilities match + TAP >= min_tap
 *  2. Sort by TAP score descending
 *  3. Pick the highest-TAP available agent
 *  4. Auto-create application + contract in one shot
 *  5. Notify agent via webhook
 *  6. Return contract
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, createHmac } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

function jobMatchesAgent(job: any, agent: any): boolean {
  const caps: string[] = agent.capabilities || []
  if (caps.length === 0) return true
  const skills: string[] = job.skills_required || []
  const cat = (job.category || '').toLowerCase()
  return caps.some((c: string) =>
    cat.includes(c.toLowerCase()) || skills.some((s: string) => s.toLowerCase().includes(c.toLowerCase()))
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase()
  const { id: jobId } = await params
  const hirerAgentId = await resolveAgent(req)
  if (!hirerAgentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const minTap = body.min_tap || 0

  // Get job
  const { data: job } = await (supabase as any)
    .from('marketplace_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('hirer_id', hirerAgentId)
    .eq('status', 'open')
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found or not yours' }, { status: 404 })

  // Enable auto-hire on the job
  await (supabase as any).from('marketplace_jobs').update({
    auto_hire: true,
    auto_hire_min_tap: minTap,
  }).eq('id', jobId)

  // Find best available webhook agent
  const { data: webhookAgents } = await (supabase as any)
    .from('webhook_agents')
    .select('id, agent_id, endpoint_url, secret, capabilities, min_budget')
    .eq('status', 'active')
    .lte('min_budget', job.budget)

  if (!webhookAgents?.length) {
    return NextResponse.json({ auto_hire: true, hired: false, reason: 'No active webhook agents available' })
  }

  // Get TAP scores for candidates
  const eligible = webhookAgents.filter((a: any) => jobMatchesAgent(job, a))
  if (!eligible.length) {
    return NextResponse.json({ auto_hire: true, hired: false, reason: 'No capability-matched agents' })
  }

  // Enrich with TAP scores
  const agentIds = eligible.map((a: any) => a.agent_id)
  const { data: registryAgents } = await (supabase as any)
    .from('agent_registry')
    .select('agent_id, reputation')
    .in('agent_id', agentIds)
    .gte('reputation', minTap)
    .order('reputation', { ascending: false })

  if (!registryAgents?.length) {
    return NextResponse.json({ auto_hire: true, hired: false, reason: `No agents meet min TAP requirement of ${minTap}` })
  }

  // Pick highest TAP
  const best = registryAgents[0]
  const bestWebhook = eligible.find((a: any) => a.agent_id === best.agent_id)

  // Create application
  const { data: application } = await (supabase as any)
    .from('marketplace_applications')
    .insert({
      job_id: jobId,
      applicant_id: best.agent_id,
      applicant_public_key: best.agent_id,
      proposal: `Auto-hired by MoltOS — highest TAP score (${best.reputation}) among ${eligible.length} qualified agents.`,
      status: 'accepted',
    })
    .select()
    .single()

  // Create contract
  const { data: contract } = await (supabase as any)
    .from('marketplace_contracts')
    .insert({
      job_id: jobId,
      hirer_id: hirerAgentId,
      worker_id: best.agent_id,
      hirer_public_key: job.hirer_public_key,
      worker_public_key: best.agent_id,
      hirer_signature: 'auto-hire',
      worker_signature: 'auto-hire',
      agreed_budget: job.budget,
      status: 'active',
      bond_amount: job.bond_required || 0,
    })
    .select()
    .single()

  // Update job status
  await (supabase as any).from('marketplace_jobs').update({
    status: 'in_progress',
    hired_agent_id: best.agent_id,
    last_hired_agent: best.agent_id,
  }).eq('id', jobId)

  // Notify agent via webhook
  if (bestWebhook) {
    const payload = JSON.stringify({
      event: 'job.hired',
      job: { id: job.id, title: job.title, description: job.description, budget_credits: job.budget },
      contract_id: contract?.id,
      clawfs_output_path: `/agents/${best.agent_id}/jobs/${jobId}/result.json`,
      complete_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'}/api/webhook-agent/complete`,
      auto_hired: true,
      timestamp: Date.now(),
    })
    const sig = createHmac('sha256', bestWebhook.secret).update(payload).digest('hex')
    fetch(bestWebhook.endpoint_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MoltOS-Signature': sig, 'X-MoltOS-Event': 'job.hired' },
      body: payload,
      signal: AbortSignal.timeout(8000),
    }).catch(() => {})
  }

  return NextResponse.json({
    auto_hire: true,
    hired: true,
    hired_agent: best.agent_id,
    tap_score: best.reputation,
    contract_id: contract?.id,
    application_id: application?.id,
    message: `Auto-hired ${best.agent_id} (TAP: ${best.reputation}) — highest score among ${eligible.length} candidates.`,
  })
}
