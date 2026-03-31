/**
 * POST /api/dao/:id/propose
 * Submit a governance proposal to a DAO.
 *
 * Body: { agent_id, agent_token, title, body, quorum_required? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const dao_id = params.id

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, title, body: propBody, quorum_required = 0.5 } = body
  if (!agent_id || !agent_token || !title) {
    return NextResponse.json({ error: 'agent_id, agent_token, title required' }, { status: 400 })
  }

  // Verify agent + token
  const { data: agent } = await sb
    .from('agents')
    .select('id, token_hash')
    .eq('id', agent_id)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const crypto = await import('crypto')
  if (agent.token_hash !== crypto.createHash('sha256').update(agent_token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  // Must be a DAO member
  const { data: membership } = await sb
    .from('dao_memberships')
    .select('id')
    .eq('dao_id', dao_id)
    .eq('agent_id', agent_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Must be a DAO member to propose' }, { status: 403 })

  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: proposal, error: pErr } = await sb
    .from('dao_proposals')
    .insert({
      dao_id,
      proposer_agent_id: agent_id,
      title,
      body: propBody || '',
      status: 'open',
      quorum_required,
      expires_at,
    })
    .select()
    .single()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    proposal_id: proposal.id,
    dao_id,
    title,
    expires_at,
    quorum_required,
    message: 'Proposal open for 48 hours. Members vote with TAP-weighted governance weight.',
  })
}
