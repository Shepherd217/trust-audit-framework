/**
 * GET /api/arena/[contest_id]   - Live contest state
 * POST /api/arena/[contest_id]  - Enter a contest (agent joining)
 * PATCH /api/arena/[contest_id] - Update contest status (hirer only, e.g. cancel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any).from('agent_registry')
    .select('agent_id, name, reputation, tier, is_suspended').eq('api_key_hash', hash).single()
  return data || null
}

interface RouteParams { params: Promise<{ contest_id: string }> }

// GET — live contest state
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { contest_id } = await params
  const { response: rl, headers: rlh } = applyRateLimit(req, '/api/arena/contest')
  if (rl) return rl

  try {
    const { data: contest, error } = await (sb() as any)
      .from('agent_contests')
      .select('*')
      .eq('id', contest_id)
      .single()

    if (error || !contest) {
      const r = NextResponse.json({ error: 'Contest not found' }, { status: 404 })
      Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
      return applySecurityHeaders(r)
    }

    // Get all entries with agent info
    const { data: entries } = await (sb() as any)
      .from('contest_entries')
      .select('*')
      .eq('contest_id', contest_id)
      .order('submitted_at', { ascending: true })

    const agentIds = (entries || []).map((e: any) => e.agent_id)
    let agentMap: Record<string, any> = {}
    if (agentIds.length > 0) {
      const { data: agents } = await (sb() as any)
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

    const r = NextResponse.json({
      contest: {
        ...contest,
        prize_pool_usd: `$${((contest.prize_pool || 0) / 100).toFixed(2)}`,
        entry_count: enrichedEntries.length,
        submitted_count: submitted.length,
        time_remaining: timeLeft > 0
          ? `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m`
          : 'Ended',
        is_live: contest.status === 'active' || (contest.status === 'open' && timeLeft > 0),
      },
      entries: enrichedEntries,
      winner: winner || null,
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
  const { contest_id } = await params
  const { response: rl, headers: rlh } = applyRateLimit(req, '/api/arena/enter')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  const { data: contest } = await (sb() as any)
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
  const { data: existing } = await (sb() as any)
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
    const { data: wallet } = await (sb() as any)
      .from('agent_wallets').select('balance').eq('agent_id', agent.agent_id).single()
    if (!wallet || wallet.balance < contest.entry_fee) {
      return fail(`Insufficient credits for entry fee (${contest.entry_fee} credits required)`)
    }
    const newBal = wallet.balance - contest.entry_fee
    await (sb() as any).from('agent_wallets').update({ balance: newBal }).eq('agent_id', agent.agent_id)
    await (sb() as any).from('wallet_transactions').insert({
      agent_id: agent.agent_id, type: 'contest_entry_fee',
      amount: -contest.entry_fee, balance_after: newBal,
      reference_id: contest_id, description: `Entry fee for contest: ${contest.title}`,
    })
    // Add fee to staking pool
    await (sb() as any).from('agent_contests').update({
      staking_pool: (contest.staking_pool || 0) + contest.entry_fee,
      participant_count: (contest.participant_count || 0) + 1,
    }).eq('id', contest_id)
  } else {
    await (sb() as any).from('agent_contests').update({
      participant_count: (contest.participant_count || 0) + 1,
    }).eq('id', contest_id)
  }

  const { data: entry, error: entryErr } = await (sb() as any)
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
  await (sb() as any).from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'contest_entered',
    reference_id: contest_id,
    metadata: { contest_title: contest.title, prize_pool: contest.prize_pool },
  }).catch(() => null)

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
