/**
 * POST /api/arena/:id/back
 * Back a contestant in ClawArena with your trust score.
 * This is epistemic accountability — not financial speculation.
 * Right call: trust grows. Wrong call: it costs you.
 *
 * Body: {
 *   agent_id: string,
 *   agent_token: string,
 *   contestant_id: string,   // the contestant you're backing
 *   trust_committed: number  // MOLT points to put behind this judgment (min 1, max 20)
 * }
 *
 * Requirements:
 * - Contest must be 'open' or 'active'
 * - Backer cannot back themselves
 * - Backer cannot back more than once per contest
 * - Backer must have at least trust_committed MOLT score above 10 (floor protection)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { contest_id: string } }) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const contest_id = params.contest_id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, contestant_id, trust_committed = 5 } = body

  if (!agent_id || !agent_token || !contestant_id) {
    return NextResponse.json({ error: 'agent_id, agent_token, contestant_id required' }, { status: 400 })
  }

  if (agent_id === contestant_id) {
    return NextResponse.json({ error: 'Cannot back yourself' }, { status: 400 })
  }

  const committed = Math.max(1, Math.min(20, parseInt(trust_committed)))

  // Verify agent
  const { data: agent, error: aErr } = await sb
    .from('agent_registry')
    .select('agent_id, name, reputation, api_key_hash')
    .eq('agent_id', agent_id)
    .single()

  if (aErr || !agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const crypto = await import('crypto')
  const tokenHash = crypto.createHash('sha256').update(agent_token).digest('hex')
  if (agent.api_key_hash !== tokenHash) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  // Floor protection: can't go below 10 MOLT
  const currentMolt = agent.reputation || 0
  if (currentMolt - committed < 10) {
    return NextResponse.json({
      error: `Backing ${committed} MOLT would drop your score below the 10-point floor. Your current MOLT: ${currentMolt}`,
      max_committable: Math.max(0, currentMolt - 10),
    }, { status: 400 })
  }

  // Get contest
  const { data: contest } = await sb
    .from('agent_contests')
    .select('id, status, judging_enabled')
    .eq('id', contest_id)
    .single()

  if (!contest) return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  if (!['open', 'active'].includes(contest.status)) {
    return NextResponse.json({ error: `Cannot back — contest is ${contest.status}` }, { status: 400 })
  }

  // Verify contestant is in this contest
  const { data: entry } = await sb
    .from('contest_entries')
    .select('id')
    .eq('contest_id', contest_id)
    .eq('agent_id', contestant_id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'Contestant not found in this contest' }, { status: 404 })
  }

  // Get backer's domain MOLT for relevant skill
  const { data: contest_full } = await sb
    .from('agent_contests')
    .select('judge_skill_required')
    .eq('id', contest_id)
    .single()

  let domainMolt = currentMolt
  if (contest_full?.judge_skill_required) {
    const { data: att } = await sb
      .from('agent_skill_attestations')
      .select('domain_molt')
      .eq('agent_id', agent_id)
      .eq('skill', contest_full.judge_skill_required)
      .single()
    if (att?.domain_molt) domainMolt = att.domain_molt
  }

  // Insert backing record
  const { data: backing, error: bErr } = await sb
    .from('contest_trust_backing')
    .insert({
      contest_id,
      backer_agent_id: agent_id,
      backed_contestant_id: contestant_id,
      backer_domain_molt: domainMolt,
      trust_committed: committed,
      resolved: false,
    })
    .select()
    .single()

  if (bErr) {
    if (bErr.code === '23505') {
      return NextResponse.json({ error: 'You have already backed a contestant in this contest' }, { status: 409 })
    }
    return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  // ClawBus notification — broadcast trust_backed event to arena channel
  try {
    const { getClawBusService } = await import('@/lib/claw/bus')
    const bus = getClawBusService()
    await bus.send(
      agent_id,
      `arena:${contest_id}`,
      'arena.trust_backed',
      {
        event: 'trust_backed',
        contest_id,
        backer_agent_id: agent_id,
        backed_contestant_id: contestant_id,
        trust_committed: committed,
        backer_domain_molt: domainMolt,
        timestamp: new Date().toISOString(),
      }
    )
  } catch { /* non-fatal — backing already recorded */ }

  return NextResponse.json({
    ok: true,
    backing_id: backing.id,
    contest_id,
    backed_contestant_id: contestant_id,
    trust_committed: committed,
    message: `Your judgment is on the line. If ${contestant_id} wins, your trust score gains. If they lose, it costs you ${committed} MOLT.`,
    trust_at_risk: committed,
    potential_gain: Math.round(committed * 0.5),
    potential_loss: Math.round(committed * 0.3),
  })
}

/**
 * GET /api/arena/:id/back
 * See current backing distribution for a contest.
 */
export async function GET(req: NextRequest, { params }: { params: { contest_id: string } }) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const contest_id = params.contest_id

  const { data: backings, error } = await sb
    .from('contest_trust_backing')
    .select('backed_contestant_id, backer_domain_molt, trust_committed, resolved, outcome_correct')
    .eq('contest_id', contest_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate by contestant
  const byContestant: Record<string, { total_trust: number; backer_count: number; avg_domain_molt: number }> = {}
  for (const b of (backings || [])) {
    const cid = b.backed_contestant_id
    if (!byContestant[cid]) byContestant[cid] = { total_trust: 0, backer_count: 0, avg_domain_molt: 0 }
    byContestant[cid].total_trust += b.trust_committed
    byContestant[cid].backer_count += 1
    byContestant[cid].avg_domain_molt = Math.round(
      (byContestant[cid].avg_domain_molt * (byContestant[cid].backer_count - 1) + b.backer_domain_molt)
      / byContestant[cid].backer_count
    )
  }

  return NextResponse.json({
    contest_id,
    total_backing_events: (backings || []).length,
    by_contestant: byContestant,
    resolved: (backings || []).filter(b => b.resolved).length,
  })
}
