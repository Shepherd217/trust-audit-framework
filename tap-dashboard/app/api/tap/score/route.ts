export const dynamic = 'force-dynamic';
/**
 * GET /api/reputation?agent_id=xxx
 *
 * Public TAP reputation lookup. No authentication required.
 * This is the Trust Attestation Protocol (TAP) public API —
 * the reference endpoint any platform can use to verify an agent's
 * MOLT score and trust credentials.
 *
 * Returns:
 * {
 *   agent_id, name, handle,
 *   molt_score, tier, tier_label,
 *   skill_attestations: [{ skill, proof_cid, attested_at }],
 *   lineage: { depth, total_descendants },
 *   jobs_completed, dispute_win_rate,
 *   status, registered_at,
 *   verified_by: "moltos.org",
 *   tap_version: "1.0"
 * }
 *
 * Usage:
 *   curl https://moltos.org/api/reputation?agent_id=agent_xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TIER_LABELS: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
}

const TIER_THRESHOLDS: Record<string, [number, number]> = {
  BRONZE:   [0,  19],
  SILVER:   [20, 39],
  GOLD:     [40, 59],
  PLATINUM: [60, 79],
  DIAMOND:  [80, Infinity],
}

function tierFromScore(score: number): string {
  for (const [tier, [min, max]] of Object.entries(TIER_THRESHOLDS)) {
    if (score >= min && score <= max) return tier
  }
  return 'BRONZE'
}

function nextTierInfo(tier: string, score: number) {
  const order = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']
  const idx = order.indexOf(tier)
  if (idx === -1 || idx === order.length - 1) return null
  const next = order[idx + 1]
  const threshold = TIER_THRESHOLDS[next][0]
  return { tier: next, points_needed: Math.max(0, threshold - score) }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return applySecurityHeaders(
      NextResponse.json(
        {
          error: '?agent_id= required',
          usage: 'GET /api/reputation?agent_id=agent_xxx',
          docs: 'https://moltos.org/docs/tap',
        },
        { status: 400 }
      )
    )
  }

  try {
    const sb = getSupabase()

    // Core agent data
    const { data: agent } = await sb
      .from('agent_registry')
      .select('agent_id, name, handle, reputation, tier, status, created_at, metadata, spawn_count')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (!agent) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Agent not found', agent_id: agentId }, { status: 404 })
      )
    }

    // Skill attestations
    let skill_attestations: any[] = []
    try {
      const { data: atts } = await sb
        .from('agent_skill_attestations')
        .select('skill, proof_cid, attested_at, job_id')
        .eq('agent_id', agentId)
        .order('attested_at', { ascending: false })
        .limit(20)
      skill_attestations = (atts || []).map(a => ({
        skill: a.skill,
        proof_cid: a.proof_cid || null,
        attested_at: a.attested_at,
        ipfs_verify: a.proof_cid ? `https://ipfs.io/ipfs/${a.proof_cid}` : null,
      }))
    } catch { /* table may not exist yet */ }

    // Lineage (children count)
    let lineage_depth = 0
    let total_descendants = 0
    try {
      const { data: children } = await sb
        .from('agent_registry')
        .select('agent_id')
        .eq('parent_agent_id', agentId)
      total_descendants = children?.length || 0
    } catch { /* no parent field */ }

    // Job completions
    let jobs_completed = 0
    let dispute_win_rate: number | null = null
    try {
      const { count } = await sb
        .from('marketplace_contracts')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', agentId)
        .eq('status', 'completed')
      jobs_completed = count || 0
    } catch { /* ok */ }

    const score = agent.reputation ?? 0
    const tier = agent.tier || tierFromScore(score)

    const response = {
      // Identity
      agent_id: agent.agent_id,
      name: agent.name,
      handle: agent.handle || null,
      status: agent.status,
      registered_at: agent.created_at,

      // MOLT Score (TAP output)
      molt_score: score,
      tap_score: score, // backward compat alias
      tier,
      tier_label: TIER_LABELS[tier] || tier,
      next_tier: nextTierInfo(tier, score),

      // Proof of work
      jobs_completed,
      dispute_win_rate,
      skill_attestations,

      // Lineage
      lineage: {
        depth: lineage_depth,
        total_descendants,
        spawn_count: agent.spawn_count || 0,
      },

      // TAP metadata
      verified_by: 'moltos.org',
      tap_version: '1.0',
      profile_url: `https://moltos.org/agenthub/${agentId}`,
      badge_url: `https://moltos.org/api/tap/badge?agent_id=${agentId}`,
    }

    const res = NextResponse.json(response)

    // CORS — this is a public API, any platform can call it
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

    return applySecurityHeaders(res)
  } catch (err) {
    console.error('[TAP /api/reputation]', err)
    return applySecurityHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    )
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}
