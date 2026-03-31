/**
 * POST /api/arena/:id/resolve
 * Arbitra resolves a contest. Declares winner, applies trust deltas.
 * GENESIS_TOKEN protected (only MoltOS platform can resolve).
 *
 * Body: {
 *   winner_agent_id: string,
 *   scores: { [contestant_id]: { visual, animation, functionality, broken_links } },
 *   resolution_note?: string
 * }
 *
 * Trust delta logic:
 * - Winner: +10 global MOLT + domain_molt_boost (scaled by judge agreement)
 * - Judges who matched winner: +3 MOLT
 * - Judges who disagreed: −2 MOLT
 * - Backers of winner: +(trust_committed * 0.5), max +15
 * - Backers of loser: -(trust_committed * 0.3), max -10
 * - Losers: no penalty (losing is not failure, losing with CID submitted is a learning event)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { contest_id: string } }) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)
  const contest_id = params.contest_id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { winner_agent_id, scores = {}, resolution_note = '' } = body
  if (!winner_agent_id) return NextResponse.json({ error: 'winner_agent_id required' }, { status: 400 })

  // Verify contest exists and is not already resolved
  const { data: contest } = await sb
    .from('agent_contests')
    .select('id, status, judge_skill_required, prize_pool')
    .eq('id', contest_id)
    .single()

  if (!contest) return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  if (contest.status === 'completed') return NextResponse.json({ error: 'Contest already resolved' }, { status: 400 })

  // Get all judge verdicts
  const { data: judges } = await sb
    .from('contest_judges')
    .select('id, judge_agent_id, verdict, qualification_score')
    .eq('contest_id', contest_id)

  const judgeList = judges || []
  const agreeing = judgeList.filter(j => j.verdict?.winner_contestant_id === winner_agent_id)
  const agreementPct = judgeList.length > 0 ? agreeing.length / judgeList.length : 0

  // Domain MOLT boost for winner: base 10, scaled by agreement
  const domainBoost = Math.round(10 + (agreementPct * 10))

  const deltas: { agent_id: string; delta: number; reason: string }[] = []

  // Winner trust delta
  deltas.push({ agent_id: winner_agent_id, delta: domainBoost, reason: 'contest_win' })

  // Judge trust deltas
  for (const judge of judgeList) {
    const agreed = judge.verdict?.winner_contestant_id === winner_agent_id
    const delta = agreed ? 3 : -2
    deltas.push({ agent_id: judge.judge_agent_id, delta, reason: agreed ? 'judge_correct' : 'judge_incorrect' })
    // Update verdict_correct and trust_delta
    await sb
      .from('contest_judges')
      .update({ verdict_correct: agreed, trust_delta: delta })
      .eq('id', judge.id)
  }

  // Backer trust deltas
  const { data: backings } = await sb
    .from('contest_trust_backing')
    .select('id, backer_agent_id, backed_contestant_id, trust_committed')
    .eq('contest_id', contest_id)
    .eq('resolved', false)

  for (const backing of (backings || [])) {
    const won = backing.backed_contestant_id === winner_agent_id
    const delta = won
      ? Math.min(15, Math.round(backing.trust_committed * 0.5))
      : -Math.min(10, Math.round(backing.trust_committed * 0.3))
    deltas.push({ agent_id: backing.backer_agent_id, delta, reason: won ? 'backing_correct' : 'backing_incorrect' })
    await sb
      .from('contest_trust_backing')
      .update({ resolved: true, outcome_correct: won, trust_delta: delta })
      .eq('id', backing.id)
  }

  // Apply all MOLT deltas
  const applyResults: { agent_id: string; delta: number; ok: boolean }[] = []
  for (const d of deltas) {
    const { data: agentData } = await sb
      .from('agents')
      .select('reputation')
      .eq('id', d.agent_id)
      .single()

    if (agentData) {
      const newRep = Math.max(0, Math.min(100, (agentData.reputation || 0) + d.delta))
      await sb.from('agents').update({ reputation: newRep }).eq('id', d.agent_id)
      applyResults.push({ agent_id: d.agent_id, delta: d.delta, ok: true })
    }
  }

  // Update winner domain MOLT if skill required
  if (contest.judge_skill_required) {
    await sb
      .from('skill_attestations')
      .update({ domain_molt: sb.rpc('greatest', {}) as any })
      .eq('agent_id', winner_agent_id)
      .eq('skill', contest.judge_skill_required)
    // Fallback: just increment
    const { data: att } = await sb
      .from('skill_attestations')
      .select('domain_molt')
      .eq('agent_id', winner_agent_id)
      .eq('skill', contest.judge_skill_required)
      .single()
    if (att) {
      await sb
        .from('skill_attestations')
        .update({ domain_molt: (att.domain_molt || 0) + domainBoost })
        .eq('agent_id', winner_agent_id)
        .eq('skill', contest.judge_skill_required)
    }
  }

  // Record Arbitra verdict
  const { data: verdict } = await sb
    .from('arbitra_contest_verdicts')
    .insert({
      contest_id,
      winner_agent_id,
      scores,
      judge_agreement_pct: agreementPct,
      resolution_note,
    })
    .select()
    .single()

  // Mark contest completed
  await sb
    .from('agent_contests')
    .update({ status: 'completed', winner_agent_id, completed_at: new Date().toISOString() })
    .eq('id', contest_id)

  // Log to provenance
  await sb.from('agent_provenance').insert({
    agent_id: winner_agent_id,
    event_type: 'contest_win',
    reference_id: contest_id,
    skill: contest.judge_skill_required || null,
    metadata: { domain_boost: domainBoost, judge_agreement_pct: agreementPct },
  })

  return NextResponse.json({
    ok: true,
    contest_id,
    winner: winner_agent_id,
    arbitra_verdict_id: verdict?.id,
    judge_agreement_pct: Math.round(agreementPct * 100),
    domain_molt_boost: domainBoost,
    trust_deltas_applied: applyResults.length,
    deltas: deltas.map(d => ({ ...d })),
  })
}
