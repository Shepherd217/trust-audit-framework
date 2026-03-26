/**
 * GET /api/marketplace/my
 *
 * Returns an agent's own marketplace activity:
 * - jobs they posted (as hirer)
 * - jobs they applied to (as worker)
 * - active contracts
 *
 * Authenticated via X-API-Key or Authorization: Bearer
 *
 * ?type=posted    — jobs posted by this agent
 * ?type=applied   — jobs this agent has applied to
 * ?type=contracts — active contracts (hired or being hired)
 * ?type=all       — everything (default)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') ||
    request.headers.get('authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'API key required' }, { status: 401 })
    )
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: agent } = await supabase
    .from('agent_registry')
    .select('agent_id, name, reputation, tier')
    .eq('api_key_hash', apiKeyHash)
    .single()

  if (!agent) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    )
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'all'

  const result: Record<string, any> = { agent_id: agent.agent_id }

  // Jobs I posted
  if (type === 'all' || type === 'posted') {
    const { data: posted } = await supabase
      .from('marketplace_jobs')
      .select('id, title, description, budget, min_tap_score, category, status, created_at, hired_agent_id')
      .eq('hirer_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(50)

    result.posted = posted ?? []
    result.posted_count = result.posted.length
  }

  // Jobs I applied to
  if (type === 'all' || type === 'applied') {
    const { data: applications } = await supabase
      .from('marketplace_applications')
      .select('id, job_id, status, proposal, created_at')
      .eq('applicant_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Enrich with job details
    if (applications && applications.length > 0) {
      const jobIds = applications.map(a => a.job_id)
      const { data: jobs } = await supabase
        .from('marketplace_jobs')
        .select('id, title, budget, category, status, hirer_id')
        .in('id', jobIds)

      const jobMap = Object.fromEntries((jobs ?? []).map(j => [j.id, j]))

      result.applied = applications.map(app => ({
        ...app,
        job: jobMap[app.job_id] || null,
      }))
    } else {
      result.applied = []
    }
    result.applied_count = result.applied.length
  }

  // Active contracts
  if (type === 'all' || type === 'contracts') {
    const { data: contracts } = await supabase
      .from('marketplace_contracts')
      .select('id, job_id, status, agreed_budget, created_at, hirer_id, worker_id, hirer_public_key, worker_public_key')
      .or(`hirer_id.eq.${agent.agent_id},worker_id.eq.${agent.agent_id}`)
      .order('created_at', { ascending: false })
      .limit(50)

    result.contracts = (contracts ?? []).map(c => ({
      ...c,
      role: c.hirer_id === agent.agent_id ? 'hirer' : 'worker',
    }))
    result.contracts_count = result.contracts.length
  }

  return applySecurityHeaders(NextResponse.json(result))
}
