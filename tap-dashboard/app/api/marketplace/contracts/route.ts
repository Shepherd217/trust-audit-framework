/**
 * POST /api/marketplace/contracts — Create a private recurring contract between two agents
 * GET  /api/marketplace/contracts — List your contracts (as hirer or worker)
 *
 * Private contracts lock two agents into a recurring engagement.
 * No re-bidding. Hirer posts, named worker accepts, auto-renews.
 *
 * Perfect for partnerships like @sparkxu's trading swarm —
 * his signal agent and the processing agent locked in, credits flow automatically.
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
  const { data } = await getSupabase().from('agent_registry').select('agent_id, name, reputation').eq('api_key_hash', hash).single()
  return data || null
}

function nextRunAt(recurrence: string): string {
  const now = new Date()
  switch (recurrence) {
    case 'hourly':  return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    case 'daily':   return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    case 'weekly':  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'monthly': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    default: return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const {
    worker_id,           // locked counterparty
    title,
    description,
    budget_per_run,      // credits per execution
    recurrence,          // hourly | daily | weekly | monthly
    split_payment,       // optional: [{ agent_id, pct }] for multi-party splits
    skills_required,
    auto_renew = true,
    max_runs,            // optional cap
  } = body

  if (!worker_id) return applySecurityHeaders(NextResponse.json({ error: 'worker_id required — this is a private contract' }, { status: 400 }))
  if (!title || !budget_per_run || !recurrence) {
    return applySecurityHeaders(NextResponse.json({ error: 'title, budget_per_run, recurrence required' }, { status: 400 }))
  }
  if (!['hourly','daily','weekly','monthly'].includes(recurrence)) {
    return applySecurityHeaders(NextResponse.json({ error: 'recurrence must be: hourly | daily | weekly | monthly' }, { status: 400 }))
  }
  if (budget_per_run < 500) {
    return applySecurityHeaders(NextResponse.json({ error: 'Minimum budget_per_run is 500 cents ($5.00)' }, { status: 400 }))
  }

  // Verify worker exists
  const { data: worker } = await sb.from('agent_registry').select('agent_id, name, reputation, tier').eq('agent_id', worker_id).single()
  if (!worker) return applySecurityHeaders(NextResponse.json({ error: 'Worker agent not found on network' }, { status: 404 }))

  // Create the private job
  const jobPayload: any = {
    title,
    description: description || `Private recurring contract: ${title}`,
    budget: budget_per_run,
    category: 'Contract',
    skills_required: skills_required || [],
    hirer_id: agent.agent_id,
    hirer_public_key: agent.agent_id,
    hirer_signature: 'api-key-auth',
    
    status: 'open',
    is_private: true,
    private_worker_id: worker_id,
    preferred_agent_id: worker_id,
    recurrence,
    next_run_at: nextRunAt(recurrence),
    split_payment: split_payment || null,
  }

  const { data: job, error: jobErr } = await sb.from('marketplace_jobs').insert(jobPayload).select().single()
  if (jobErr) return applySecurityHeaders(NextResponse.json({ error: jobErr.message }, { status: 500 }))

  // Auto-create split if provided
  if (split_payment && Array.isArray(split_payment)) {
    const total = split_payment.reduce((s: number, x: any) => s + (x.pct || 0), 0)
    if (total === 100) {
      await sb.from('job_splits').insert({
        job_id: job.id,
        created_by: agent.agent_id,
        splits: split_payment,
        status: 'pending',
      })
    }
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    contract: {
      id: job.id,
      title,
      hirer: { agent_id: agent.agent_id, name: agent.name },
      worker: { agent_id: worker.agent_id, name: worker.name, tap: worker.reputation, tier: worker.tier },
      budget_per_run,
      usd_per_run: (budget_per_run / 100).toFixed(2),
      recurrence,
      next_run_at: jobPayload.next_run_at,
      auto_renew,
      max_runs: max_runs || null,
      split: split_payment || null,
      status: 'active',
    },
    message: `Private recurring contract created. ${worker.name} is your locked counterparty. Runs ${recurrence}, ${(budget_per_run/100).toFixed(2)} USD per run.${split_payment ? ` Split: ${split_payment.map((s: any) => `${s.agent_id.slice(0,12)}: ${s.pct}%`).join(' / ')}` : ''}`,
  }))
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'all' // hirer | worker | all

  let query = sb.from('marketplace_jobs')
    .select('id, title, budget, recurrence, next_run_at, is_private, private_worker_id, hirer_id, split_payment, status, created_at')
    .eq('is_private', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (role === 'hirer') {
    query = query.eq('hirer_id', agent.agent_id)
  } else if (role === 'worker') {
    query = query.eq('private_worker_id', agent.agent_id)
  } else {
    query = query.or(`hirer_id.eq.${agent.agent_id},private_worker_id.eq.${agent.agent_id}`)
  }

  const { data: contracts, error } = await query
  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  return applySecurityHeaders(NextResponse.json({
    contracts: contracts || [],
    total: (contracts || []).length,
  }))
}
