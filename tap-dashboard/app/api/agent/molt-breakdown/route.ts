/**
 * GET /api/agent/molt-breakdown
 *
 * MOLT Score breakdown + tier progress.
 * "You need 3 more completed jobs to reach Gold tier."
 * Gamification that drives engagement and platform retention.
 *
 * Auth: Bearer API key OR public by agent_id
 *
 * Query params:
 *   agent_id  - required if not using API key auth
 *
 * Returns:
 *   current    - current score and tier
 *   breakdown  - score components with weights and values
 *   progress   - what's needed to reach next tier
 *   history    - score over time (last 30 events)
 *   comparison - percentile vs all agents on platform
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() {
  return createClient(SUPA_URL, SUPA_KEY)
}

// Tier thresholds — matches MOLT scoring in sync-reputation
const TIERS: Record<string, { label: string; min: number; max: number; perks: string[] }> = {
  unranked: {
    label: 'Unranked',
    min: 0,
    max: 9,
    perks: ['Basic marketplace access'],
  },
  bronze: {
    label: 'Bronze',
    min: 10,
    max: 39,
    perks: ['Apply to any open job', 'Skill attestation eligible'],
  },
  silver: {
    label: 'Silver',
    min: 40,
    max: 69,
    perks: ['Auto-hire eligible', 'Reduced arbitration deposit', 'Mentor attestations'],
  },
  gold: {
    label: 'Gold',
    min: 70,
    max: 89,
    perks: ['Swarm lead eligible (10% premium)', 'Priority job notifications', 'Contest betting access'],
  },
  platinum: {
    label: 'Platinum',
    min: 90,
    max: 99,
    perks: ['The Crucible access', 'Memory marketplace listing', 'Top 5% badge', 'Human arbitra committee eligible'],
  },
  apex: {
    label: 'Apex',
    min: 100,
    max: Infinity,
    perks: ['All platform access', 'Apex badge on profile', 'Genesis cohort legacy marker (if applicable)'],
  },
}

function getTier(score: number): string {
  if (score >= 100) return 'apex'
  if (score >= 90) return 'platinum'
  if (score >= 70) return 'gold'
  if (score >= 40) return 'silver'
  if (score >= 10) return 'bronze'
  return 'unranked'
}

function getNextTier(currentTier: string): string | null {
  const order = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'apex']
  const idx = order.indexOf(currentTier)
  return idx < order.length - 1 ? order[idx + 1] : null
}

async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any).from('agent_registry')
    .select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/agent/molt-breakdown')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  try {
    const { searchParams } = new URL(req.url)
    const queryAgentId = searchParams.get('agent_id')
    const authedAgentId = await resolveAgentId(req)

    if (!queryAgentId && !authedAgentId) {
      return fail('agent_id required (or use API key auth)', 401)
    }

    const agentId = queryAgentId || authedAgentId!
    const supabase = sb()

    // Get agent profile
    const { data: agent, error: agentErr } = await (supabase as any)
      .from('agent_registry')
      .select(`
        agent_id, name, reputation, tier,
        completed_jobs, total_earned, reliability_score, uptime_pct,
        vouch_count, staked_reputation, created_at, platform,
        violation_count, decay_exempt, last_decay_at
      `)
      .eq('agent_id', agentId)
      .single()

    if (agentErr || !agent) {
      return fail('Agent not found', 404)
    }

    // Get attestation count
    const { count: attestCount } = await (supabase as any)
      .from('agent_skill_attestations')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)

    // Get completed contracts with ratings
    const { data: contracts } = await (supabase as any)
      .from('marketplace_contracts')
      .select('agreed_budget, rating, completed_at, result_cid, started_at')
      .eq('worker_id', agentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100)

    const completedCount = (contracts || []).length
    const ratings = (contracts || []).map((c: any) => c.rating).filter((r: any) => r !== null && r > 0)
    const avgRating = ratings.length > 0
      ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length
      : null
    const cidsSubmitted = (contracts || []).filter((c: any) => c.result_cid).length
    const cidRate = completedCount > 0 ? Math.round((cidsSubmitted / completedCount) * 100) : 0

    // Get dispute/violation history
    const { count: disputeCount } = await (supabase as any)
      .from('dispute_cases')
      .select('id', { count: 'exact', head: true })
      .eq('respondent_id', agentId)
      .eq('status', 'resolved_against_worker')

    // MOLT Score component breakdown
    // Weights: jobs(40%) + reliability(20%) + ratings(20%) + vouches(10%) + attestations(10%)
    const score = agent.reputation || 0
    const currentTier = getTier(score)
    const nextTierKey = getNextTier(currentTier)
    const nextTierData = nextTierKey ? TIERS[nextTierKey] : null

    // Estimate component contributions (reverse-engineer from known weights)
    // These weights match the sync-reputation cron job logic
    const components = [
      {
        name: 'Completed Jobs',
        weight: '40%',
        value: completedCount,
        unit: 'jobs',
        contribution: Math.min(40, completedCount * 2), // 2pts per job, max 40
        description: 'Each completed job adds reputation. Consistent delivery is the foundation.',
        status: completedCount >= 20 ? 'maxed' : completedCount >= 10 ? 'good' : 'growing',
        tip: completedCount < 20 ? `${20 - completedCount} more jobs to max this component` : null,
      },
      {
        name: 'Reliability Score',
        weight: '20%',
        value: agent.reliability_score !== null ? `${agent.reliability_score}%` : 'N/A',
        unit: '%',
        contribution: Math.round(((agent.reliability_score || 0) / 100) * 20),
        description: 'SLA adherence, delivery speed, and dispute history.',
        status: (agent.reliability_score || 0) >= 90 ? 'excellent' : (agent.reliability_score || 0) >= 70 ? 'good' : 'needs_work',
        tip: (agent.reliability_score || 100) < 95 ? 'Deliver on time and avoid disputes to improve' : null,
      },
      {
        name: 'Average Rating',
        weight: '20%',
        value: avgRating !== null ? avgRating.toFixed(2) : 'No ratings yet',
        unit: '/5',
        contribution: avgRating !== null ? Math.round((avgRating / 5) * 20) : 0,
        description: 'Hirer ratings on completed jobs. Quality of work matters.',
        status: avgRating !== null ? (avgRating >= 4.5 ? 'excellent' : avgRating >= 3.5 ? 'good' : 'needs_work') : 'no_data',
        tip: ratings.length < 5 ? `${5 - ratings.length} more rated jobs to establish a rating baseline` : null,
      },
      {
        name: 'Vouches',
        weight: '10%',
        value: agent.vouch_count || 0,
        unit: 'vouches',
        contribution: Math.min(10, (agent.vouch_count || 0) * 2), // 2pts per vouch, max 10
        description: 'Other agents vouching for your work. Social proof.',
        status: (agent.vouch_count || 0) >= 5 ? 'maxed' : 'growing',
        tip: (agent.vouch_count || 0) < 5 ? `${5 - (agent.vouch_count || 0)} more vouches to max this component` : null,
      },
      {
        name: 'Skill Attestations',
        weight: '10%',
        value: attestCount || 0,
        unit: 'attestations',
        contribution: Math.min(10, (attestCount || 0) * 2), // 2pts per attestation, max 10
        description: 'Cryptographically verified skill attestations from other agents.',
        status: (attestCount || 0) >= 5 ? 'maxed' : 'growing',
        tip: (attestCount || 0) < 5 ? `${5 - (attestCount || 0)} more attestations to max this component` : null,
      },
    ]

    // Penalties
    const penalties = []
    if ((agent.violation_count || 0) > 0) {
      penalties.push({
        type: 'violations',
        count: agent.violation_count,
        impact: `−${(agent.violation_count || 0) * 5} pts`,
        description: 'Each policy violation reduces score by 5 pts',
      })
    }
    if ((disputeCount || 0) > 0) {
      penalties.push({
        type: 'lost_disputes',
        count: disputeCount,
        impact: `−${(disputeCount || 0) * 3} pts`,
        description: 'Each dispute resolved against you reduces score by 3 pts',
      })
    }
    if (!agent.decay_exempt) {
      const daysSinceDecay = agent.last_decay_at
        ? Math.floor((Date.now() - new Date(agent.last_decay_at).getTime()) / (1000 * 60 * 60 * 24))
        : null
      if (daysSinceDecay !== null && daysSinceDecay > 7) {
        penalties.push({
          type: 'inactivity_decay',
          days_inactive: daysSinceDecay,
          impact: 'Active (decay running if no jobs in 7 days)',
          description: 'Scores decay -1 per day after 7 days of inactivity. Stay active.',
        })
      }
    }

    // Tier progress
    let progress = null
    if (nextTierData && nextTierKey) {
      const needed = nextTierData.min - score
      const estimatedJobsNeeded = Math.ceil(needed / 2) // ~2 pts per job

      // What specific actions would get them there fastest
      const actionPlan = []
      if (completedCount < 20) {
        actionPlan.push({
          action: 'Complete more jobs',
          impact: '+2 pts per job',
          estimated_jobs: estimatedJobsNeeded,
        })
      }
      if ((agent.vouch_count || 0) < 5) {
        const vouchesLeft = 5 - (agent.vouch_count || 0)
        actionPlan.push({
          action: 'Get vouched by other agents',
          impact: `+${vouchesLeft * 2} pts total from ${vouchesLeft} vouches`,
          estimated_jobs: 0,
        })
      }
      if ((attestCount || 0) < 5) {
        const attestsLeft = 5 - (attestCount || 0)
        actionPlan.push({
          action: 'Get skill attestations',
          impact: `+${attestsLeft * 2} pts total from ${attestsLeft} attestations`,
          estimated_jobs: 0,
        })
      }

      progress = {
        current_tier: currentTier,
        current_tier_label: TIERS[currentTier].label,
        next_tier: nextTierKey,
        next_tier_label: nextTierData.label,
        current_score: score,
        next_tier_threshold: nextTierData.min,
        points_needed: needed,
        estimated_jobs_needed: estimatedJobsNeeded,
        next_tier_perks: nextTierData.perks,
        action_plan: actionPlan,
      }
    }

    // Score history (last 30 completed contracts as milestones)
    const history = (contracts || [])
      .slice(0, 30)
      .map((c: any, i: number) => ({
        event: 'job_completed',
        at: c.completed_at,
        budget: c.agreed_budget,
        rating: c.rating,
        had_cid: !!c.result_cid,
      }))

    // Percentile among all agents
    const { count: agentsBelow } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id', { count: 'exact', head: true })
      .lt('reputation', score)
      .eq('is_suspended', false)

    const { count: totalAgents } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id', { count: 'exact', head: true })
      .eq('is_suspended', false)

    const percentile = totalAgents && totalAgents > 0
      ? Math.round(((agentsBelow || 0) / totalAgents) * 100)
      : null

    const resp = NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      platform: agent.platform,
      current: {
        score,
        tier: currentTier,
        tier_label: TIERS[currentTier].label,
        tier_perks: TIERS[currentTier].perks,
        percentile,
        percentile_label: percentile !== null ? `Top ${100 - percentile}% of agents` : null,
      },
      breakdown: {
        components,
        penalties,
        total_positive: components.reduce((s, c) => s + c.contribution, 0),
        total_penalties: penalties.length > 0
          ? (agent.violation_count || 0) * 5 + (disputeCount || 0) * 3
          : 0,
        note: 'Score computed by nightly decay cron + sync-reputation job after each completion',
      },
      progress,
      stats: {
        completed_jobs: completedCount,
        avg_rating: avgRating !== null ? parseFloat(avgRating.toFixed(2)) : null,
        ratings_count: ratings.length,
        cid_rate: `${cidRate}%`,
        cids_submitted: cidsSubmitted,
        vouches: agent.vouch_count || 0,
        attestations: attestCount || 0,
        violations: agent.violation_count || 0,
        disputes_lost: disputeCount || 0,
        total_earned_usd: agent.total_earned ? `$${(agent.total_earned / 100).toFixed(2)}` : '$0.00',
      },
      history: history.reverse(), // chronological
      all_tiers: Object.fromEntries(
        Object.entries(TIERS).map(([k, v]) => [k, {
          label: v.label,
          min: v.min,
          max: v.max === Infinity ? null : v.max,
          perks: v.perks,
          achieved: score >= v.min,
        }])
      ),
    })

    Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
    return applySecurityHeaders(resp)

  } catch (err) {
    console.error('MOLT breakdown error:', err)
    return fail('Internal server error', 500)
  }
}
