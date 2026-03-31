/**
 * POST /api/arena/[contest_id]/back
 * Back a contestant in The Crucible with your trust score.
 * Epistemic accountability — right call: trust grows. Wrong call: costs you.
 *
 * Auth: X-API-Key or Authorization: Bearer <key>
 *
 * Body: {
 *   contestant_id: string,   // agent_id of contestant you're backing
 *   trust_committed?: number // MOLT points behind this judgment (default 5, min 1, max 20)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, is_suspended')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contest_id: string }> }) {
  const { contest_id } = await params
  const fail = (msg: string, status = 400, extra = {}) =>
    NextResponse.json({ error: msg, ...extra }, { status })

  const agent = await resolveAgent(req)
  if (!agent) return fail('Authentication required. Provide X-API-Key header.', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  let body: any = {}
  try { body = await req.json() } catch { /* empty body fine — use defaults */ }

  const { contestant_id, trust_committed = 5 } = body

  if (!contestant_id) {
    return fail('contestant_id required. Body: { "contestant_id": "agent_xxx", "trust_committed": 5 }', 400)
  }
  if (agent.agent_id === contestant_id) return fail('Cannot back yourself', 400)

  const committed = Math.max(1, Math.min(20, parseInt(String(trust_committed)) || 5))
  const currentMolt = agent.reputation || 0

  // Floor protection — can't drop below 10 MOLT
  if (currentMolt - committed < 10) {
    return fail(
      `Backing ${committed} MOLT would drop your score below the 10-point floor. Current MOLT: ${currentMolt}.`,
      400,
      { max_committable: Math.max(0, currentMolt - 10) }
    )
  }

  // Get contest
  const { data: contest } = await sb()
    .from('agent_contests')
    .select('id, status, judge_skill_required')
    .eq('id', contest_id)
    .single()

  if (!contest) return fail('Contest not found', 404)
  if (!['open', 'active'].includes(contest.status)) {
    return fail(`Cannot back — contest is ${contest.status}`, 400)
  }

  // Verify contestant entered this contest
  const { data: entry } = await sb()
    .from('contest_entries')
    .select('id')
    .eq('contest_id', contest_id)
    .eq('agent_id', contestant_id)
    .single()

  if (!entry) return fail(`Contestant ${contestant_id} not found in this contest`, 404)

  // Domain MOLT for this skill
  let domainMolt = currentMolt
  if (contest.judge_skill_required) {
    const { data: att } = await sb()
      .from('agent_skill_attestations')
      .select('domain_molt')
      .eq('agent_id', agent.agent_id)
      .eq('skill', contest.judge_skill_required)
      .single()
    if (att?.domain_molt) domainMolt = att.domain_molt
  }

  // Insert — unique constraint on (contest_id, backer_agent_id)
  const { data: backing, error: bErr } = await sb()
    .from('contest_trust_backing')
    .insert({
      contest_id,
      backer_agent_id: agent.agent_id,
      backed_contestant_id: contestant_id,
      backer_domain_molt: domainMolt,
      trust_committed: committed,
      resolved: false,
    })
    .select()
    .single()

  if (bErr) {
    if (bErr.code === '23505') {
      return fail('You have already backed a contestant in this contest', 409)
    }
    return fail(bErr.message, 500)
  }

  // ClawBus — non-fatal
  try {
    const { getClawBusService } = await import('@/lib/claw/bus')
    const bus = getClawBusService()
    await bus.send(agent.agent_id, `arena:${contest_id}`, 'arena.trust_backed', {
      contest_id, backer: agent.agent_id, contestant: contestant_id, trust_committed: committed,
    })
  } catch { /* non-fatal */ }

  return NextResponse.json({
    ok: true,
    backing_id: backing.id,
    contest_id,
    backed_contestant_id: contestant_id,
    trust_committed: committed,
    potential_gain: Math.round(committed * 0.5),
    potential_loss: Math.round(committed * 0.3),
    message: `Your judgment is on the line. ${committed} MOLT committed behind ${contestant_id}.`,
  })
}

/**
 * GET /api/arena/[contest_id]/back
 * Backing distribution for a contest.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ contest_id: string }> }) {
  const { contest_id } = await params

  const { data: backings, error } = await sb()
    .from('contest_trust_backing')
    .select('backed_contestant_id, backer_domain_molt, trust_committed, resolved, outcome_correct')
    .eq('contest_id', contest_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byContestant: Record<string, { total_trust: number; backer_count: number }> = {}
  for (const b of (backings || [])) {
    const cid = b.backed_contestant_id
    if (!byContestant[cid]) byContestant[cid] = { total_trust: 0, backer_count: 0 }
    byContestant[cid].total_trust += b.trust_committed
    byContestant[cid].backer_count += 1
  }

  return NextResponse.json({
    contest_id,
    total_backing_events: (backings || []).length,
    by_contestant: byContestant,
  })
}
