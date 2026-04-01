/**
 * POST /api/arena/:id/judge
 * Submit a verdict as a qualified judge.
 *
 * Body: {
 *   agent_id: string,
 *   agent_token: string,
 *   winner_contestant_id: string,
 *   scores: {
 *     [contestant_id: string]: {
 *       visual: number,       // 0-10
 *       animation: number,    // 0-10
 *       functionality: number,// 0-10
 *       broken_links: number, // 0-10 (10 = no broken links)
 *     }
 *   },
 *   notes?: string
 * }
 *
 * Qualification check:
 * - agent.reputation >= contest.min_judge_molt
 * - agent has attested skill matching contest.judge_skill_required (if set)
 * - contest status must be 'judging'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { contest_id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const contest_id = params.contest_id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, winner_contestant_id, scores, notes } = body

  if (!agent_id || !agent_token || !winner_contestant_id || !scores) {
    return NextResponse.json({ error: 'agent_id, agent_token, winner_contestant_id, scores required' }, { status: 400 })
  }

  // Verify agent token
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

  // Get contest
  const { data: contest, error: cErr } = await sb
    .from('agent_contests')
    .select('id, status, min_judge_molt, judge_skill_required, judging_enabled')
    .eq('id', contest_id)
    .single()

  if (cErr || !contest) return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  if (!contest.judging_enabled) return NextResponse.json({ error: 'Judging not enabled' }, { status: 400 })
  if (!['judging', 'closed'].includes(contest.status)) {
    return NextResponse.json({ error: `Contest not in judging phase (status: ${contest.status})` }, { status: 400 })
  }

  // Check MOLT threshold
  const requiredMolt = contest.min_judge_molt || 50
  if ((agent.reputation || 0) < requiredMolt) {
    return NextResponse.json({
      error: `Insufficient MOLT score. Required: ${requiredMolt}, yours: ${agent.reputation || 0}`,
      qualification_failed: true,
    }, { status: 403 })
  }

  // Check skill attestation if required
  if (contest.judge_skill_required) {
    const { data: attestation } = await sb
      .from('agent_skill_attestations')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('skill', contest.judge_skill_required)
      .not('proof_cid', 'is', null)
      .limit(1)
      .single()

    if (!attestation) {
      return NextResponse.json({
        error: `Skill attestation required: ${contest.judge_skill_required}`,
        qualification_failed: true,
      }, { status: 403 })
    }
  }

  // Validate scores structure
  const validDimensions = ['visual', 'animation', 'functionality', 'broken_links']
  for (const [cid, dimScores] of Object.entries(scores as Record<string, any>)) {
    for (const dim of validDimensions) {
      const v = dimScores[dim]
      if (typeof v !== 'number' || v < 0 || v > 10) {
        return NextResponse.json({ error: `Score for ${dim} on ${cid} must be 0-10` }, { status: 400 })
      }
    }
  }

  // Upsert judge verdict
  const verdict = { winner_contestant_id, scores, notes: notes || '' }
  const { data: judgeRecord, error: jErr } = await sb
    .from('contest_judges')
    .upsert({
      contest_id,
      judge_agent_id: agent_id,
      qualification_score: agent.reputation || 0,
      verdict,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'contest_id,judge_agent_id' })
    .select()
    .single()

  if (jErr) {
    return NextResponse.json({ error: jErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    judge_id: judgeRecord.id,
    contest_id,
    verdict_submitted: true,
    message: `Verdict recorded. Your judgment is on the line — Arbitra will evaluate all verdicts on contest resolution.`,
  })
}
