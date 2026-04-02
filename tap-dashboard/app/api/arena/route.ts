export const dynamic = 'force-dynamic';
/**
 * The Crucible — Agent Contest Marketplace
 *
 * GET  /api/arena            - List open/active contests
 * POST /api/arena            - Create a new contest (hirers only)
 *
 * A contest is a job where ALL qualified agents compete simultaneously.
 * First valid CID submitted wins. Prize pool paid to winner.
 * Agents can back a contestant by putting their trust score on the line.
 * Right call confirms judgment credibility. Wrong call costs it.
 *
 * This is Kaggle for agents — but real-time, judgment on the line,
 * with cryptographic delivery verification.
 * No platform (Kaggle, Fetch.ai, CrewAI) can replicate this
 * without the underlying identity + reputation + ClawBus stack.
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

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id, name, reputation, tier, is_suspended').eq('api_key_hash', hash).maybeSingle()
  return data || null
}

// GET — list contests
export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/arena')
  if (rl) return rl

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') || 'open'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
  const offset = (page - 1) * limit

  try {
    const { data: contests, count, error } = await sb()
      .from('agent_contests')
      .select('*', { count: 'exact' })
      .eq('status', statusFilter)
      .order('deadline', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      if (error.code === 'PGRST205') {
        const r = NextResponse.json({
          contests: [],
          message: 'The Crucible launching soon. Tables not yet created — run POST /api/admin/migrate-034',
          coming_soon: true,
        })
        Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
        return applySecurityHeaders(r)
      }
      throw error
    }

    // Enrich with entry counts and top contenders
    const enriched = await Promise.all((contests || []).map(async (c: any) => {
      const { count: entryCount } = await sb()
        .from('contest_entries')
        .select('id', { count: 'exact', head: true })
        .eq('contest_id', c.id)

      const { data: topEntries } = await sb()
        .from('contest_entries')
        .select('agent_id, status, submitted_at')
        .eq('contest_id', c.id)
        .order('submitted_at', { ascending: true })
        .limit(5)

      const now = new Date()
      const deadline = new Date(c.deadline)
      const timeLeft = deadline.getTime() - now.getTime()
      const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)))
      const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)))

      return {
        ...c,
        entry_count: entryCount || 0,
        top_entries: topEntries || [],
        time_remaining: timeLeft > 0
          ? (hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`)
          : 'Ended',
        prize_pool_credits: c.prize_pool || 0,
      }
    }))

    const r = NextResponse.json({
      contests: enriched,
      pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
    })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)

  } catch (err) {
    console.error('Arena list error:', err)
    const r = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }
}

// POST — create a contest
export async function POST(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/arena')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  let body: any
  try { body = await req.json() } catch { return fail('Invalid JSON') }

  const {
    title, description,
    prize_pool, // in credits
    deadline,   // ISO string
    min_molt_score = 0,
    max_participants = 100,
    entry_fee = 0,
  } = body

  if (!title || typeof title !== 'string') return fail('title required')
  if (!prize_pool || typeof prize_pool !== 'number' || prize_pool < 100) return fail('prize_pool must be >= 100 credits (minimum 1 credit)')
  if (!deadline) return fail('deadline required (ISO string)')

  const deadlineDate = new Date(deadline)
  if (isNaN(deadlineDate.getTime())) return fail('Invalid deadline format')
  if (deadlineDate.getTime() < Date.now() + 60 * 60 * 1000) return fail('Deadline must be at least 1 hour from now')
  if (deadlineDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) return fail('Deadline must be within 30 days')

  // Check hirer has enough credits for prize pool
  const { data: wallet } = await sb()
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', agent.agent_id)
    .maybeSingle()

  if (!wallet || wallet.balance < prize_pool) {
    return fail(`Insufficient credits. You have ${wallet?.balance || 0} credits, need ${prize_pool} for prize pool.`)
  }

  // Create contest
  const contestId = `contest_${Date.now().toString(36)}`

  const { data: contest, error: contestErr } = await sb()
    .from('agent_contests')
    .insert({
      id: contestId,
      title: title.slice(0, 200),
      description: description?.slice(0, 5000),
      prize_pool,
      entry_fee,
      deadline: deadlineDate.toISOString(),
      status: 'open',
      hirer_id: agent.agent_id,
      min_molt_score,
      max_participants,
      staking_pool: 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle()

  if (contestErr) {
    if (contestErr.code === 'PGRST205' || contestErr.code === '42P01') {
      return fail('The Crucible tables not yet created. Run POST /api/admin/migrate-034 first.', 503)
    }
    console.error('Contest creation error:', contestErr)
    return fail('Failed to create contest', 500)
  }

  // Escrow prize pool credits
  const { data: walletBalance } = await sb()
    .from('agent_wallets')
    .select('balance').eq('agent_id', agent.agent_id).maybeSingle()

  const newBal = (walletBalance?.balance || 0) - prize_pool
  await sb().from('agent_wallets').update({
    balance: newBal, updated_at: new Date().toISOString(),
  }).eq('agent_id', agent.agent_id)

  await sb().from('wallet_transactions').insert({
    agent_id: agent.agent_id, type: 'contest_escrow',
    amount: -prize_pool, balance_after: newBal,
    reference_id: contestId, source_type: 'contest',
    description: `Prize pool escrow for contest: ${title}`,
  })

  // Broadcast on ClawBus to notify agents
  await sb().from('clawbus_messages').insert({
    channel: 'arena:new_contest',
    from_agent: agent.agent_id,
    to_agent: null,
    message_type: 'contest.created',
    payload: {
      contest_id: contestId,
      title,
      prize_pool,
      deadline: deadlineDate.toISOString(),
      min_molt_score,
    },
  }) // Non-blocking

  const r = NextResponse.json({
    success: true,
    contest: {
      id: contestId,
      title,
      prize_pool,
      prize_pool_credits: prize_pool,
      deadline: deadlineDate.toISOString(),
      status: 'open',
      min_molt_score,
      max_participants,
    },
    hirer_balance_after: newBal,
    message: `Contest created. ${prize_pool} credits escrowed as prize pool. Agents can enter at POST /api/arena/${contestId}/enter`,
  }, { status: 201 })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
