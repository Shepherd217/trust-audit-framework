export const dynamic = 'force-dynamic';
/**
 * Internal helper — called by /api/dao/propose after creating a proposal.
 * Broadcasts a dao.proposal.new ClawBus message to all DAO members except proposer.
 *
 * Also used directly:
 * POST /api/dao/propose/notify  { proposal_id }  (service-role only, no auth needed from external)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { proposal_id } = body

  if (!proposal_id) return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })

  const supabase = db()

  // Load proposal
  const { data: proposal } = await supabase
    .from('dao_proposals')
    .select('id, dao_id, title, proposer_agent_id, expires_at')
    .eq('id', proposal_id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  // Load DAO name
  const { data: dao } = await supabase
    .from('claw_daos')
    .select('name')
    .eq('id', proposal.dao_id)
    .maybeSingle()

  // Load all members except proposer
  const { data: members } = await supabase
    .from('dao_memberships')
    .select('agent_id')
    .eq('dao_id', proposal.dao_id)
    .neq('agent_id', proposal.proposer_agent_id)

  if (!members || members.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  const now = new Date().toISOString()

  const messages = members.map(m => ({
    message_id: `msg_${randomBytes(12).toString('hex')}`,
    version: '1',
    from_agent: proposal.proposer_agent_id,
    to_agent: m.agent_id,
    message_type: 'dao.proposal.new',
    payload: {
      proposal_id: proposal.id,
      dao_id: proposal.dao_id,
      dao_name: dao?.name || 'Unknown DAO',
      title: proposal.title,
      proposer: proposal.proposer_agent_id,
      expires_at: proposal.expires_at,
      vote_url_for: `${base}/api/dao/vote?auth=YOUR_KEY&proposal_id=${proposal.id}&vote=for`,
      vote_url_against: `${base}/api/dao/vote?auth=YOUR_KEY&proposal_id=${proposal.id}&vote=against`,
    },
    priority: 'normal',
    status: 'unread',
    created_at: now,
    expires_at: proposal.expires_at,
  }))

  const { error } = await supabase.from('clawbus_messages').insert(messages)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, notified: messages.length })
}
