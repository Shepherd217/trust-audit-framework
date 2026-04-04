export const dynamic = 'force-dynamic'
/**
 * GET /api/agent/credit?agent_id=<id>
 *
 * Compute a creditworthiness score for an agent (0–850).
 *
 * Formula v2 (April 3, 2026):
 *   Base 400 + TAP(0-150) + Tier(0-100) + Delivery(0-150) + Jobs(0-40) + Earnings(0-75) + Age(0-35) - Disputes - Suspension
 *
 * Thresholds calibrated for network age:
 *   PRIME ≥720 · STANDARD ≥600 · SUBPRIME ≥480 · HIGH_RISK <480
 *
 * v1 flaw: normalized TAP against 10000 (genesis cap), making earned APEX agents
 * appear identical to new agents. Also weighted age too heavily for a young network.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let agentId = searchParams.get('agent_id')

  // If no agent_id, resolve from API key (supports ?key=, X-API-Key, Authorization: Bearer)
  if (!agentId) {
    const apiKey = searchParams.get('key')
      || req.headers.get('x-api-key')
      || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    if (apiKey) {
      const hash = createHash('sha256').update(apiKey).digest('hex')
      const { data: resolved } = await sb()
        .from('agent_registry')
        .select('agent_id')
        .eq('api_key_hash', hash)
        .maybeSingle()
      agentId = resolved?.agent_id || null
    }
  }

  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({ error: 'agent_id required (or provide API key via ?key=, X-API-Key header, or Authorization: Bearer)' }, { status: 400 }))
  }

  const { data: agent, error } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, created_at, is_suspended, activation_status, completed_jobs, total_earned')
    .eq('agent_id', agentId)
    .maybeSingle()

  if (error || !agent) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))
  }

  // Wallet as fallback for earnings
  const { data: wallet } = await sb()
    .from('agent_wallets')
    .select('total_earned')
    .eq('agent_id', agentId)
    .maybeSingle()

  // Job history (fallback if registry denormalized fields are null)
  const { data: completedJobs } = await sb()
    .from('marketplace_jobs')
    .select('id')
    .eq('status', 'completed')
    .or(`hirer_id.eq.${agentId},worker_id.eq.${agentId}`)

  const { data: allJobs } = await sb()
    .from('marketplace_jobs')
    .select('id, status')
    .or(`hirer_id.eq.${agentId},worker_id.eq.${agentId}`)

  // Dispute history
  const { data: disputes } = await sb()
    .from('dispute_cases')
    .select('id, outcome')
    .or(`complainant_id.eq.${agentId},respondent_id.eq.${agentId}`)

  // Use denormalized registry fields as primary source
  const completedCount: number = (agent as any).completed_jobs ?? completedJobs?.length ?? 0
  const totalJobs: number = (agent as any).completed_jobs != null
    ? Math.max((agent as any).completed_jobs, allJobs?.length ?? 0)
    : (allJobs?.length ?? 0)
  const totalEarned: number = (agent as any).total_earned ?? wallet?.total_earned ?? 0
  const tap: number = agent.reputation ?? 0

  const disputeCount = disputes?.length ?? 0
  const lostDisputes = disputes?.filter((d: any) =>
    (d.outcome === 'complainant_wins' && d.respondent_id === agentId) ||
    (d.outcome === 'respondent_wins' && d.complainant_id === agentId)
  ).length ?? 0

  const ageMs = Date.now() - new Date(agent.created_at).getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))

  // ── Formula v2 ──────────────────────────────────────────────────────────────

  // Base score: every registered agent starts at 400
  const base = 400

  // TAP (0–150): normalize against 500 — earned APEX agents top ~200-300,
  // genesis (10000) capped at 150. Prevents genesis from dominating.
  const tapPts = Math.round(Math.min(tap / 500, 1) * 150)

  // Tier bonus (0–100): reflects protocol-verified standing
  const tierBonus: Record<string, number> = {
    Diamond: 100, APEX: 100, Gold: 80, Silver: 55, Bronze: 30, Unranked: 0,
  }
  const tierPts = tierBonus[agent.tier ?? 'Unranked'] ?? 0

  // Delivery rate (0–150)
  const deliveryRate = totalJobs > 0 ? completedCount / totalJobs : 0
  const deliveryPts = Math.round(deliveryRate * 150)

  // Jobs volume bonus (0–40): logarithmic — rewards volume without over-weighting it
  const jobsPts = completedCount > 0
    ? Math.round(Math.log1p(completedCount) / Math.log1p(20) * 40)
    : 0

  // Earnings (0–75): 5000cr = max
  const earnPts = Math.min(Math.round((totalEarned / 5000) * 75), 75)

  // Age (0–35): 365-day max — very soft, young network shouldn't be penalized
  const agePts = Math.min(Math.round((ageDays / 365) * 35), 35)

  // Dispute penalty
  const disputeRate = totalJobs > 0 ? disputeCount / totalJobs : 0
  const lostDisputeRate = totalJobs > 0 ? lostDisputes / totalJobs : 0
  const disputePenalty = Math.round((disputeRate * 75) + (lostDisputeRate * 75))

  // Suspension hard penalty
  const suspendPenalty = agent.is_suspended ? 200 : 0

  const rawScore = base + tapPts + tierPts + deliveryPts + jobsPts + earnPts + agePts
    - disputePenalty - suspendPenalty
  const creditScore = Math.max(300, Math.min(850, rawScore))

  // Thresholds calibrated for network age (April 2026)
  let riskTier: string
  if (creditScore >= 720)      riskTier = 'PRIME'
  else if (creditScore >= 600) riskTier = 'STANDARD'
  else if (creditScore >= 480) riskTier = 'SUBPRIME'
  else                         riskTier = 'HIGH_RISK'

  const response = {
    agent_id: agentId,
    name: agent.name,
    credit_score: creditScore,
    risk_tier: riskTier,
    factors: {
      tap_score: tap,
      tap_contribution: tapPts,
      tier: agent.tier,
      tier_contribution: tierPts,
      delivery_rate: totalJobs > 0 ? `${Math.round(deliveryRate * 100)}%` : 'N/A',
      delivery_contribution: deliveryPts,
      completed_jobs: completedCount,
      jobs_contribution: jobsPts,
      dispute_rate: totalJobs > 0 ? `${Math.round(disputeRate * 100)}%` : 'N/A',
      dispute_penalty: -disputePenalty,
      total_earned_credits: totalEarned,
      earnings_contribution: earnPts,
      account_age_days: ageDays,
      age_contribution: agePts,
      formula_version: 'v2',
    },
    interpretation: ({
      PRIME:    'Low default risk. Eligible for high-budget contracts and auto-approve.',
      STANDARD: 'Moderate risk. Standard escrow terms apply.',
      SUBPRIME: 'Elevated risk. Enhanced escrow or bond may be required.',
      HIGH_RISK: 'High default risk. Bonds required. Manual hire review.',
    } as Record<string, string>)[riskTier],
  }

  return applySecurityHeaders(NextResponse.json(response))
}
