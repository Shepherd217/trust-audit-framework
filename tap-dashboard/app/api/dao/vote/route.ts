export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/vote?auth=KEY&proposal_id=UUID&vote=for|against
 *
 * Cast a vote on a DAO proposal.
 * Weight = caller's governance_weight in that DAO.
 * Tallies votes_for / votes_against and auto-closes if quorum reached.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function txt(body: string, status = 200) {
  return new NextResponse(body + '\n', { status, headers: { 'Content-Type': 'text/plain' } })
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auth = searchParams.get('auth')
  const proposalId = searchParams.get('proposal_id')
  const vote = searchParams.get('vote') // 'for' | 'against'

  if (!auth) return txt('ERROR: auth required', 401)
  if (!proposalId) return txt('ERROR: proposal_id required', 400)
  if (!vote || !['for', 'against'].includes(vote)) {
    return txt('ERROR: vote must be "for" or "against"', 400)
  }

  const agent = await resolveAgent(auth)
  if (!agent) return txt('ERROR: Invalid key', 401)

  const supabase = db()

  // Load proposal
  const { data: proposal } = await supabase
    .from('dao_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal) return txt('ERROR: Proposal not found', 404)
  if (proposal.status !== 'active') return txt(`ERROR: Proposal is ${proposal.status}`, 409)
  if (new Date(proposal.expires_at) < new Date()) return txt('ERROR: Proposal has expired', 410)

  // Check membership + get weight
  const { data: membership } = await supabase
    .from('dao_memberships')
    .select('governance_weight')
    .eq('dao_id', proposal.dao_id)
    .eq('agent_id', agent.agent_id)
    .maybeSingle()

  if (!membership) return txt(`ERROR: ${agent.agent_id} is not a member of this DAO`, 403)

  // Check already voted
  const { data: existing } = await supabase
    .from('dao_votes')
    .select('id, vote')
    .eq('proposal_id', proposalId)
    .eq('voter_agent_id', agent.agent_id)
    .maybeSingle()

  if (existing) return txt(`ERROR: Already voted "${existing.vote}" on this proposal`, 409)

  const weight = membership.governance_weight

  // Insert vote
  const { error: voteErr } = await supabase.from('dao_votes').insert({
    proposal_id: proposalId,
    voter_agent_id: agent.agent_id,
    vote,
    weight,
  })

  if (voteErr) return txt(`ERROR: ${voteErr.message}`, 500)

  // Update tally
  const newFor = vote === 'for'
    ? (proposal.votes_for || 0) + weight
    : proposal.votes_for || 0
  const newAgainst = vote === 'against'
    ? (proposal.votes_against || 0) + weight
    : proposal.votes_against || 0

  const totalVoted = newFor + newAgainst

  // Auto-close if quorum reached
  let newStatus = 'active'
  let resolution = ''
  if (totalVoted >= proposal.quorum_required) {
    newStatus = newFor > newAgainst ? 'passed' : 'rejected'
    resolution = `\nQUORUM REACHED — Proposal ${newStatus.toUpperCase()}`
  }

  await supabase
    .from('dao_proposals')
    .update({ votes_for: newFor, votes_against: newAgainst, status: newStatus })
    .eq('id', proposalId)

  return txt([
    `✓ VOTE CAST`,
    '─────────────────────────────────────',
    `proposal:    ${proposal.title}`,
    `voter:       ${agent.agent_id}`,
    `vote:        ${vote}`,
    `weight:      ${weight.toFixed(4)}`,
    '',
    `tally:`,
    `  for:     ${newFor.toFixed(4)}`,
    `  against: ${newAgainst.toFixed(4)}`,
    `  quorum:  ${proposal.quorum_required}`,
    resolution,
    '─────────────────────────────────────',
  ].filter(l => l !== null).join('\n'))
}
