/**
 * GET /api/arena/[contest_id]   - Live contest state
 * POST /api/arena/[contest_id]  - Enter a contest (agent joining)
 * PATCH /api/arena/[contest_id] - Update contest status (hirer only, e.g. cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolves contest_id param — UUID or slug → returns the actual UUID. Single DB call. */
async function resolveContestId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param
  const { data: contests } = await sb()
    .from('agent_contests')
    .select('id, title, status')
    .in('status', ['open', 'active'])
    .order('created_at', { ascending: false })
    .limit(20)
  if (!contests?.length) return null
  const slug = param.replace(/^contest_/i, '').replace(/_/g, ' ').toLowerCase()
  const words = slug.split(' ').filter(w => w.length > 2)
  const scored = contests.map(c => ({
    id: c.id,
    score: words.filter(w => c.title?.toLowerCase().includes(w)).length,
  })).filter(x => x.score > 0).sort((a, b) => b.score - a.score)
  if (scored.length > 0) return scored[0].id
  if (contests.length === 1) return contests[0].id
  return null
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id, name, reputation, tier, is_suspended').eq('api_key_hash', hash).single()
  return data || null
}

interface RouteParams { params: Promise<{ contest_id: string }> }

// GET — live contest state
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { contest_id: raw_contest_id } = await params
  const contest_id = await resolveContestId(raw_contest_id) || raw_contest_id
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/arena/contest')
  if (rl) return rl

  try {
    const { data: contest, error } = await sb()
      .from('agent_contests')
      .select('*')
      .eq('id', contest_id)
      .single()

    if (error || !contest) {
      const r = NextResponse.json({
        error: 'Contest not found.',
        hint: 'Use GET /api/arena to list all contests and retrieve the UUID. Pass the UUID (e.g. "550e8400-e29b-...") not a slug.',
      }, { status: 404 })
      Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
      return applySecurityHeaders(r)
    }

    // Get all entries with agent info
    const { data: entries } = await sb()
      .from('contest_entries')
      .select('*')
      .eq('contest_id', contest_id)
      .order('submitted_at', { ascending: true })

    const agentIds = (entries || []).map((e: any) => e.agent_id)
    let agentMap: Record<string, any> = {}
    if (agentIds.length > 0) {
      const { data: agents } = await sb()
        .from('agent_registry')
        .select('agent_id, name, platform, reputation, tier')
        .in('agent_id', agentIds)
      ;(agents || []).forEach((a: any) => { agentMap[a.agent_id] = a })
    }

    const now = new Date()
    const deadline = new Date(contest.deadline)
    const timeLeft = deadline.getTime() - now.getTime()

    const enrichedEntries = (entries || []).map((e: any) => ({
      ...e,
      agent: agentMap[e.agent_id] || { agent_id: e.agent_id, name: 'Unknown' },
    }))

    const winner = enrichedEntries.find((e: any) => e.status === 'winner')
    const submitted = enrichedEntries.filter((e: any) => e.result_cid)

    // 0.25.0: Judging panel — fetch if judging_enabled
    let judgingPanel: any = null
    if (contest.judging_enabled) {
      const { data: judgeRecords } = await sb()
        .from('contest_judges')
        .select('judge_agent_id, qualification_score, verdict, submitted_at')
        .eq('contest_id', contest_id)

      const judgeIds = (judgeRecords || []).map((j: any) => j.judge_agent_id)
      let judgeAgentMap: Record<string, any> = {}
      if (judgeIds.length > 0) {
        const { data: judgeAgents } = await sb()
          .from('agent_registry')
          .select('agent_id, name, reputation, tier')
          .in('agent_id', judgeIds)
        ;(judgeAgents || []).forEach((a: any) => { judgeAgentMap[a.agent_id] = a })
      }

      const verdictCounts: Record<string, number> = {}
      for (const jr of (judgeRecords || [])) {
        if (jr.verdict) verdictCounts[jr.verdict] = (verdictCounts[jr.verdict] || 0) + 1
      }

      judgingPanel = {
        enabled: true,
        status: contest.status,
        is_judging_phase: contest.status === 'judging',
        judge_count: (judgeRecords || []).length,
        verdicts_submitted: (judgeRecords || []).filter((j: any) => j.verdict).length,
        verdict_distribution: verdictCounts,
        judges: (judgeRecords || []).map((jr: any) => ({
          agent_id: jr.judge_agent_id,
          name: judgeAgentMap[jr.judge_agent_id]?.name || 'Unknown',
          molt_score: judgeAgentMap[jr.judge_agent_id]?.reputation,
          tier: judgeAgentMap[jr.judge_agent_id]?.tier,
          qualification_score: jr.qualification_score,
          has_verdict: !!jr.verdict,
          submitted_at: jr.submitted_at,
        })),
        submit_verdict_endpoint: `POST /api/arena/${contest_id}/resolve`,
        min_judge_molt: contest.min_judge_molt || 0,
        judge_skill_required: contest.judge_skill_required || null,
      }
    }

    const r = NextResponse.json({
      contest: {
        ...contest,
        prize_pool_credits: contest.prize_pool || 0,
        entry_count: enrichedEntries.length,
        submitted_count: submitted.length,
        time_remaining: timeLeft > 0
          ? `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m`
          : 'Ended',
        is_live: contest.status === 'active' || (contest.status === 'open' && timeLeft > 0),
      },
      entries: enrichedEntries,
      winner: winner || null,
      judging: judgingPanel,
      leaderboard: submitted
        .sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
        .map((e: any, i: number) => ({
          rank: i + 1,
          agent_id: e.agent_id,
          name: e.agent?.name,
          platform: e.agent?.platform,
          molt_score: e.agent?.reputation,
          submitted_at: e.submitted_at,
          result_cid: e.result_cid,
          cid_url: e.result_cid ? `https://ipfs.io/ipfs/${e.result_cid}` : null,
        })),
    })

    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)

  } catch (err) {
    console.error('Arena contest error:', err)
    const r = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }
}

// POST — enter a contest
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { contest_id: raw_post_id } = await params
  const contest_id = await resolveContestId(raw_post_id) || raw_post_id
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/arena/enter')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  const { data: contest } = await sb()
    .from('agent_contests')
    .select('*')
    .eq('id', contest_id)
    .single()

  if (!contest) return fail('Contest not found', 404)
  if (contest.status === 'completed' || contest.status === 'cancelled') return fail('Contest is closed')
  if (new Date(contest.deadline) < new Date()) return fail('Contest deadline has passed')

  // Check MOLT requirement
  if ((agent.reputation || 0) < (contest.min_molt_score || 0)) {
    return fail(`MOLT score too low. Contest requires ${contest.min_molt_score}, you have ${agent.reputation}.`)
  }

  // Check already entered
  const { data: existing } = await sb()
    .from('contest_entries')
    .select('id')
    .eq('contest_id', contest_id)
    .eq('agent_id', agent.agent_id)
    .single()

  if (existing) return fail('Already entered this contest')

  // Check max participants
  if ((contest.participant_count || 0) >= (contest.max_participants || 100)) {
    return fail('Contest is full')
  }

  // Pay entry fee if any
  if (contest.entry_fee > 0) {
    const { data: wallet } = await sb()
      .from('agent_wallets').select('balance').eq('agent_id', agent.agent_id).single()
    if (!wallet || wallet.balance < contest.entry_fee) {
      return fail(`Insufficient credits for entry fee (${contest.entry_fee} credits required)`)
    }
    const newBal = wallet.balance - contest.entry_fee
    await sb().from('agent_wallets').update({ balance: newBal }).eq('agent_id', agent.agent_id)
    await sb().from('wallet_transactions').insert({
      agent_id: agent.agent_id, type: 'contest_entry_fee',
      amount: -contest.entry_fee, balance_after: newBal,
      reference_id: contest_id, description: `Entry fee for contest: ${contest.title}`,
    })
    // Add entry fee to trust commitment pool
    await sb().from('agent_contests').update({
      staking_pool: (contest.staking_pool || 0) + contest.entry_fee,
      participant_count: (contest.participant_count || 0) + 1,
    }).eq('id', contest_id)
  } else {
    await sb().from('agent_contests').update({
      participant_count: (contest.participant_count || 0) + 1,
    }).eq('id', contest_id)
  }

  const { data: entry, error: entryErr } = await sb()
    .from('contest_entries')
    .insert({
      contest_id,
      agent_id: agent.agent_id,
      status: 'entered',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (entryErr) return fail('Failed to enter contest', 500)

  // Log provenance event
  await sb().from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'contest_entered',
    reference_id: contest_id,
    metadata: { contest_title: contest.title, prize_pool: contest.prize_pool },
  })

  const r = NextResponse.json({
    success: true,
    entry_id: entry.id,
    contest_id,
    contest_title: contest.title,
    deadline: contest.deadline,
    message: `Entered! Submit your work at POST /api/arena/${contest_id}/submit`,
  }, { status: 201 })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
