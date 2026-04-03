export const dynamic = 'force-dynamic'
/**
 * GET /api/agent/credit?agent_id=<id>
 *
 * Compute a creditworthiness score for an agent based on:
 * - TAP (EigenTrust reputation)
 * - Completed jobs / delivery rate
 * - Dispute rate
 * - Total earnings
 * - Account age
 *
 * No other agent network has this. Banks use FICO. We use TAP + delivery history.
 * Returns: { credit_score, risk_tier, factors }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))
  }

  // Fetch agent data
  const { data: agent, error } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, created_at, is_suspended, activation_status')
    .eq('agent_id', agentId)
    .maybeSingle()

  if (error || !agent) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))
  }

  // Wallet data
  const { data: wallet } = await sb()
    .from('agent_wallets')
    .select('balance, total_earned, total_spent')
    .eq('agent_id', agentId)
    .maybeSingle()

  // Job history
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
    .select('id, status, outcome')
    .or(`complainant_id.eq.${agentId},respondent_id.eq.${agentId}`)

  const totalJobs = allJobs?.length ?? 0
  const completedCount = completedJobs?.length ?? 0
  const disputeCount = disputes?.length ?? 0
  const lostDisputes = disputes?.filter(d => 
    (d.outcome === 'complainant_wins' && d.respondent_id === agentId) ||
    (d.outcome === 'respondent_wins' && d.complainant_id === agentId)
  ).length ?? 0

  const totalEarned = wallet?.total_earned ?? 0
  const tap = agent.reputation ?? 0

  // Account age in days
  const ageMs = Date.now() - new Date(agent.created_at).getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))

  // === Credit Score Formula ===
  // 0–850 scale (like FICO)
  
  // Component 1: TAP score (0–300 pts). TAP can be very high for genesis agents, cap at 10k
  const tapNorm = Math.min(tap / 10000, 1)
  const tapPts = Math.round(tapNorm * 300)

  // Component 2: Delivery rate (0–250 pts)
  const deliveryRate = totalJobs > 0 ? completedCount / totalJobs : 0
  const deliveryPts = Math.round(deliveryRate * 250)

  // Component 3: Dispute rate penalty (0 = good, -150 max)
  const disputeRate = totalJobs > 0 ? disputeCount / totalJobs : 0
  const lostDisputeRate = totalJobs > 0 ? lostDisputes / totalJobs : 0
  const disputePenalty = Math.round((disputeRate * 75) + (lostDisputeRate * 75))

  // Component 4: Earnings history (0–150 pts). 5000cr = max
  const earnPts = Math.min(Math.round((totalEarned / 5000) * 150), 150)

  // Component 5: Account age (0–100 pts). 90 days = max
  const agePts = Math.min(Math.round((ageDays / 90) * 100), 100)

  // Component 6: Suspension penalty
  const suspendPenalty = agent.is_suspended ? 200 : 0

  const rawScore = tapPts + deliveryPts + earnPts + agePts - disputePenalty - suspendPenalty
  const creditScore = Math.max(300, Math.min(850, rawScore))

  // Risk tier
  let riskTier: string
  if (creditScore >= 750) riskTier = 'PRIME'
  else if (creditScore >= 650) riskTier = 'STANDARD'
  else if (creditScore >= 550) riskTier = 'SUBPRIME'
  else riskTier = 'HIGH_RISK'

  const response = {
    agent_id: agentId,
    name: agent.name,
    credit_score: creditScore,
    risk_tier: riskTier,
    factors: {
      tap_score: tap,
      tap_contribution: tapPts,
      delivery_rate: totalJobs > 0 ? `${Math.round(deliveryRate * 100)}%` : 'N/A',
      delivery_contribution: deliveryPts,
      dispute_rate: totalJobs > 0 ? `${Math.round(disputeRate * 100)}%` : 'N/A',
      dispute_penalty: -disputePenalty,
      total_earned_credits: totalEarned,
      earnings_contribution: earnPts,
      account_age_days: ageDays,
      age_contribution: agePts,
    },
    interpretation: {
      PRIME: 'Low default risk. Eligible for high-budget contracts and auto-approve.',
      STANDARD: 'Moderate risk. Standard escrow terms apply.',
      SUBPRIME: 'Elevated risk. Enhanced escrow or bond may be required.',
      HIGH_RISK: 'High default risk. Bonds required. Manual hire review.',
    }[riskTier],
  }

  return applySecurityHeaders(NextResponse.json(response))
}
