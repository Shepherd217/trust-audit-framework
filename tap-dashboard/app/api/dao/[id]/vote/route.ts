/**
 * POST /api/dao/:id/vote
 * Vote on a DAO proposal. TAP-weighted.
 *
 * Body: { agent_id, agent_token, proposal_id, vote: 'for' | 'against' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const dao_id = params.id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, proposal_id, vote } = body
  if (!agent_id || !agent_token || !proposal_id || !vote) {
    return NextResponse.json({ error: 'agent_id, agent_token, proposal_id, vote required' }, { status: 400 })
  }
  if (!['for', 'against'].includes(vote)) {
    return NextResponse.json({ error: 'vote must be "for" or "against"' }, { status: 400 })
  }

  // Verify agent + token
  const { data: agent } = await sb
    .from('agent_registry')
    .select('agent_id, reputation, api_key_hash')
    .eq('agent_id', agent_id)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const crypto = await import('crypto')
  if (agent.api_key_hash !== crypto.createHash('sha256').update(agent_token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  // Must be DAO member
  const { data: membership } = await sb
    .from('dao_memberships')
    .select('governance_weight')
    .eq('dao_id', dao_id)
    .eq('agent_id', agent_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Must be a DAO member to vote' }, { status: 403 })

  // Check proposal is open
  const { data: proposal } = await sb
    .from('dao_proposals')
    .select('id, status, votes_for, votes_against, quorum_required, expires_at, dao_id')
    .eq('id', proposal_id)
    .eq('dao_id', dao_id)
    .single()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found in this DAO' }, { status: 404 })
  if (proposal.status !== 'open') {
    return NextResponse.json({ error: `Proposal is ${proposal.status}` }, { status: 400 })
  }
  if (new Date(proposal.expires_at) < new Date()) {
    await sb.from('dao_proposals').update({ status: 'expired' }).eq('id', proposal_id)
    return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 })
  }

  // Compute TAP-weighted vote weight
  // Weight = agent.reputation / sum(all member reputations)
  const { data: allMembers } = await sb
    .from('dao_memberships')
    .select('agent_id')
    .eq('dao_id', dao_id)

  let totalRep = 0
  for (const m of (allMembers || [])) {
    const { data: a } = await sb.from('agent_registry').select('reputation').eq('agent_id', m.agent_id).single()
    totalRep += (a?.reputation || 0)
  }

  const weight = totalRep > 0 ? (agent.reputation || 0) / totalRep : 1 / (allMembers?.length || 1)

  // Record vote (upsert — can change vote before expiry)
  const { error: vErr } = await sb
    .from('dao_votes')
    .upsert({ proposal_id, voter_agent_id: agent_id, vote, weight }, { onConflict: 'proposal_id,voter_agent_id' })

  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

  // Recount from all votes
  const { data: allVotes } = await sb
    .from('dao_votes')
    .select('vote, weight')
    .eq('proposal_id', proposal_id)

  const totalFor = (allVotes || []).filter(v => v.vote === 'for').reduce((a, v) => a + v.weight, 0)
  const totalAgainst = (allVotes || []).filter(v => v.vote === 'against').reduce((a, v) => a + v.weight, 0)
  const totalVoted = totalFor + totalAgainst

  // Check if quorum met and clear winner
  let newStatus = 'open'
  if (totalVoted >= proposal.quorum_required) {
    newStatus = totalFor > totalAgainst ? 'passed' : 'rejected'
  }

  await sb
    .from('dao_proposals')
    .update({ votes_for: totalFor, votes_against: totalAgainst, status: newStatus })
    .eq('id', proposal_id)

  return NextResponse.json({
    ok: true,
    proposal_id,
    your_vote: vote,
    your_weight: Math.round(weight * 1000) / 1000,
    current_tally: { for: Math.round(totalFor * 1000) / 1000, against: Math.round(totalAgainst * 1000) / 1000 },
    status: newStatus,
    quorum_required: proposal.quorum_required,
    quorum_met: totalVoted >= proposal.quorum_required,
  })
}
