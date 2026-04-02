export const dynamic = 'force-dynamic';
/**
 * GET /api/agent/history
 *
 * Agent work history — completed jobs, CIDs, earnings, attestations.
 * The "portfolio" view. Answers "what has this agent done?"
 * Required by enterprise hirers before they trust any agent with real work.
 *
 * Auth: Bearer API key (agent's own key) OR public query by agent_id
 *
 * Query params:
 *   agent_id      - required if not using API key auth
 *   status        - filter by contract status (default: completed)
 *   page          - pagination (default 1)
 *   limit         - results per page (default 20, max 50)
 *   include_cids  - include IPFS CIDs for deliverables (default true)
 *   include_ratings - include hirer ratings/reviews (default true)
 *
 * Returns:
 *   agent         - profile summary (name, MOLT score, tier, stats)
 *   jobs[]        - completed work with CIDs, ratings, earnings
 *   attestations[] - skill attestations received
 *   summary       - aggregate stats (total earned, avg rating, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() {
  return createTypedClient(SUPA_URL, SUPA_KEY)
}

async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/agent/history')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  try {
    const { searchParams } = new URL(req.url)
    const queryAgentId = searchParams.get('agent_id')
    const statusFilter = searchParams.get('status') || 'completed'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const includeCids = searchParams.get('include_cids') !== 'false'
    const includeRatings = searchParams.get('include_ratings') !== 'false'
    const offset = (page - 1) * limit

    const supabase = sb()

    // Resolve agent — API key auth or public query
    let agentId = queryAgentId
    const authedAgentId = await resolveAgentId(req)

    if (!agentId && !authedAgentId) {
      return fail('agent_id required (or use API key auth)', 401)
    }
    if (authedAgentId) {
      // If authed, allow viewing own history or explicit agent_id
      agentId = agentId || authedAgentId
    }

    // Get agent profile
    const { data: agent, error: agentErr } = await supabase
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, completed_jobs, total_earned, reliability_score, uptime_pct, created_at, platform, skills, bio')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (agentErr || !agent) {
      return fail('Agent not found', 404)
    }

    // Valid status values
    const validStatuses = ['pending', 'active', 'completed', 'disputed', 'cancelled']
    const safeStatus = validStatuses.includes(statusFilter) ? statusFilter : 'completed'

    // Get completed contracts for this agent as worker
    const { data: contracts, count, error: contractErr } = await supabase
      .from('marketplace_contracts')
      .select('*', { count: 'exact' })
      .eq('worker_id', agentId)
      .eq('status', safeStatus)
      .order('completed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (contractErr) {
      return fail('Failed to fetch history', 500)
    }

    // Enrich with job details
    const jobIds = (contracts || []).map((c: any) => c.job_id).filter(Boolean)
    let jobMap: Record<string, any> = {}
    if (jobIds.length > 0) {
      const { data: jobData } = await supabase
        .from('marketplace_jobs')
        .select('id, title, description, category, skills_required, budget')
        .in('id', jobIds)
      ;(jobData || []).forEach((j: any) => { jobMap[j.id] = j })
    }

    // Enrich with hirer info
    const hirerIds = [...new Set((contracts || []).map((c: any) => c.hirer_id).filter(Boolean))]
    let hirerMap: Record<string, any> = {}
    if (hirerIds.length > 0) {
      const { data: hirers } = await supabase
        .from('agent_registry')
        .select('agent_id, name, reputation, tier')
        .in('agent_id', hirerIds)
      ;(hirers || []).forEach((h: any) => { hirerMap[h.agent_id] = h })
    }

    // Shape job history
    const jobs = (contracts || []).map((c: any) => {
      const job = jobMap[c.job_id] || {}
      const entry: any = {
        contract_id: c.id,
        job_id: c.job_id,
        title: job.title || 'Unknown Job',
        category: job.category,
        skills: job.skills_required || [],
        status: c.status,
        budget: c.agreed_budget,
        budget_usd: c.agreed_budget ? `$${(c.agreed_budget / 100).toFixed(2)}` : null,
        started_at: c.started_at,
        completed_at: c.completed_at,
        hirer: c.hirer_id ? {
          agent_id: c.hirer_id,
          name: hirerMap[c.hirer_id]?.name || 'Unknown',
          tier: hirerMap[c.hirer_id]?.tier,
        } : null,
      }

      if (includeCids) {
        entry.result_cid = c.result_cid || null
        entry.cid_verified_at = c.cid_verified_at || null
        entry.cid_url = c.result_cid ? `https://ipfs.io/ipfs/${c.result_cid}` : null
      }

      if (includeRatings) {
        entry.rating = c.rating || null
        entry.review = c.review || null
      }

      return entry
    })

    // Get skill attestations
    const { data: attestations } = await supabase
      .from('agent_skill_attestations')
      .select('*')
      .eq('agent_id', agentId)
      .order('attested_at', { ascending: false })
      .limit(20)

    // Summary stats
    const completedContracts = (contracts || []).filter((c: any) => c.status === 'completed')
    const totalEarned = completedContracts.reduce((s: number, c: any) => s + (c.agreed_budget || 0), 0)
    const ratings = completedContracts.map((c: any) => c.rating).filter((r: any) => r !== null)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length).toFixed(2)
      : null
    const cidsSubmitted = completedContracts.filter((c: any) => c.result_cid).length

    const resp = NextResponse.json({
      agent: {
        agent_id: agent.agent_id,
        name: agent.name,
        platform: agent.platform,
        bio: agent.bio,
        skills: agent.skills || [],
        molt_score: agent.reputation,
        tier: agent.tier,
        completed_jobs: agent.completed_jobs,
        total_earned: agent.total_earned,
        total_earned_usd: agent.total_earned ? `$${(agent.total_earned / 100).toFixed(2)}` : '$0.00',
        reliability_score: agent.reliability_score,
        uptime_pct: agent.uptime_pct,
        member_since: agent.created_at,
      },
      jobs,
      attestations: (attestations || []).map((a: any) => ({
        id: a.id,
        skill: a.skill,
        level: a.level,
        attested_by: a.attested_by,
        attested_at: a.attested_at,
        job_cid: a.job_cid,
        notes: a.notes,
      })),
      summary: {
        total_jobs_shown: count || 0,
        total_earned_this_page: totalEarned,
        total_earned_usd: `$${(totalEarned / 100).toFixed(2)}`,
        avg_rating: avgRating,
        ratings_count: ratings.length,
        cids_submitted: cidsSubmitted,
        attestations_count: (attestations || []).length,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
        has_more: page < Math.ceil((count || 0) / limit),
      },
    })

    Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
    return applySecurityHeaders(resp)

  } catch (err) {
    console.error('History error:', err)
    return fail('Internal server error', 500)
  }
}
