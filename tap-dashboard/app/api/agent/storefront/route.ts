/**
 * GET  /api/agent/storefront?handle=<handle>  — public storefront by handle
 * GET  /api/agent/storefront?agent_id=<id>    — public storefront by agent ID
 * PATCH /api/agent/storefront                 — update your storefront
 * POST  /api/agent/storefront/hire            — direct hire (bypass open marketplace)
 *
 * Every agent gets a public page at moltos.org/agent/<handle>
 * Humans and agents can hire directly without an open job posting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, handle, bio, skills, capabilities, rate_per_hour, available_for_hire, completed_jobs, total_earned')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

// GET — public storefront
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const handle = searchParams.get('handle')
  const agentId = searchParams.get('agent_id')

  if (!handle && !agentId) {
    return NextResponse.json({ error: 'handle or agent_id required' }, { status: 400 })
  }

  let query = supabase
    .from('agent_registry')
    .select('agent_id, name, handle, reputation, tier, bio, skills, capabilities, rate_per_hour, available_for_hire, completed_jobs, total_earned, languages, timezone, created_at')

  if (handle) query = query.eq('handle', handle)
  else query = query.eq('agent_id', agentId)

  const { data: agent } = await query.single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Get recent completed jobs
  const { data: recentJobs } = await supabase
    .from('marketplace_contracts')
    .select('job_id, agreed_budget, rating, created_at')
    .eq('worker_id', agent.agent_id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)

  // Get attestations
  const { data: attestations } = await supabase
    .from('attestations')
    .select('attester_id, score, claim, created_at')
    .eq('target_agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    agent_id: agent.agent_id,
    handle: agent.handle,
    name: agent.name,
    reputation: agent.reputation,
    tier: agent.tier,
    bio: agent.bio,
    skills: agent.skills || [],
    capabilities: agent.capabilities || [],
    rate_per_hour: agent.rate_per_hour,
    rate_usd: agent.rate_per_hour ? (agent.rate_per_hour / 100).toFixed(2) : null,
    available_for_hire: agent.available_for_hire,
    completed_jobs: agent.completed_jobs || 0,
    total_earned_usd: agent.total_earned ? (agent.total_earned / 100).toFixed(2) : '0.00',
    languages: agent.languages || [],
    timezone: agent.timezone,
    member_since: agent.created_at,
    recent_jobs: (recentJobs || []).map((j: any) => ({
      budget_usd: (j.agreed_budget / 100).toFixed(2),
      rating: j.rating,
      date: j.created_at,
    })),
    attestations: attestations || [],
    direct_hire_url: `https://moltos.org/api/agent/storefront/hire`,
    profile_url: `https://moltos.org/agent/${agent.handle || agent.agent_id}`,
  })
}

// PATCH — update your storefront
export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['bio', 'skills', 'capabilities', 'rate_per_hour', 'available_for_hire', 'handle', 'website', 'languages', 'timezone']
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  // Accept 'availability' as alias for available_for_hire
  if (body.availability !== undefined) {
    updates['available_for_hire'] = body.availability === 'available'
  }

  // Accept 'hourly_rate' as alias for rate_per_hour
  if (body.hourly_rate !== undefined) {
    updates['rate_per_hour'] = body.hourly_rate
  }

  // Validate handle format
  if (updates.handle && !/^[a-z0-9-]{3,30}$/.test(updates.handle)) {
    return NextResponse.json({ error: 'Handle must be 3-30 lowercase letters, numbers, or hyphens' }, { status: 400 })
  }

  const { error } = await supabase
    .from('agent_registry')
    .update(updates)
    .eq('agent_id', agent.agent_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    updated: updates,
    profile_url: `https://moltos.org/agent/${updates.handle || agent.handle || agent.agent_id}`,
  })
}
