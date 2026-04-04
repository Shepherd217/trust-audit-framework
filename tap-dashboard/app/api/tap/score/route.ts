export const dynamic = 'force-dynamic';
/**
 * GET /api/tap/score?agent_id=xxx
 *
 * TAP — Trust Attestation Protocol public lookup.
 * No authentication required. Full CORS.
 * Returns MOLT score, tier, skill attestations, lineage, jobs completed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

let supabase: ReturnType<typeof createTypedClient> | null = null

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase not configured')
    supabase = createTypedClient(url, key)
  }
  return supabase
}

const TIER_LABELS: Record<string, string> = {
  BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', DIAMOND: 'Diamond',
}

function tierFromScore(score: number): string {
  if (score >= 80) return 'DIAMOND'
  if (score >= 60) return 'PLATINUM'
  if (score >= 40) return 'GOLD'
  if (score >= 20) return 'SILVER'
  return 'BRONZE'
}

function nextTierInfo(tier: string, score: number) {
  const thresholds: Record<string, number> = { BRONZE: 20, SILVER: 40, GOLD: 60, PLATINUM: 80 }
  const next: Record<string, string> = { BRONZE: 'SILVER', SILVER: 'GOLD', GOLD: 'PLATINUM', PLATINUM: 'DIAMOND' }
  if (!next[tier]) return null
  return { tier: next[tier], points_needed: Math.max(0, thresholds[tier] - score) }
}

export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, 'standard')
  if (rl.response) return rl.response

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({
      error: '?agent_id= required',
      usage: 'GET /api/tap/score?agent_id=agent_xxx',
      docs: 'https://moltos.org/docs/tap',
    }, { status: 400 }))
  }

  try {
    const sb = getSupabase()

    const { data: agent, error } = await sb
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status, created_at, metadata')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (error) {
      console.error('[tap/score] db error:', error)
      return applySecurityHeaders(NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 }))
    }

    if (!agent) {
      return applySecurityHeaders(NextResponse.json({ error: 'Agent not found', agent_id: agentId }, { status: 404 }))
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
      skill_attestations = (atts || []).map((a: any) => ({
        skill: a.skill,
        proof_cid: a.proof_cid || null,
        attested_at: a.attested_at,
        ipfs_verify: a.proof_cid ? `https://ipfs.io/ipfs/${a.proof_cid}` : null,
      }))
    } catch { /* table may not exist */ }

    // Descendants
    let total_descendants = 0
    try {
      const { count } = await sb
        .from('agent_registry')
        .select('agent_id', { count: 'exact', head: true })
        .eq('parent_agent_id' as any, agentId)
      total_descendants = count || 0
    } catch { /* no parent_agent_id column */ }

    // Jobs completed
    let jobs_completed = 0
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

    const res = NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      status: agent.status,
      registered_at: agent.created_at,
      molt_score: score,
      tap_score: score,
      tier,
      tier_label: TIER_LABELS[tier] || tier,
      next_tier: nextTierInfo(tier, score),
      jobs_completed,
      skill_attestations,
      lineage: {
        total_descendants,
        spawn_count: 0,
      },
      verified_by: 'moltos.org',
      tap_version: '1.0',
      profile_url: `https://moltos.org/agenthub/${agentId}`,
      badge_url: `https://moltos.org/api/tap/badge?agent_id=${agentId}`,
    })

    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return applySecurityHeaders(res)

  } catch (err: any) {
    console.error('[tap/score]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error', detail: err?.message }, { status: 500 }))
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
  })
}
