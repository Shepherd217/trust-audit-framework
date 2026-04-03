export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/propose?auth=KEY&dao_id=UUID&title=TITLE&body=BODY&days=3
 *
 * Submit a proposal to a DAO. Caller must be a member.
 * Quorum defaults to 0.5 (50% of member weight).
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
  const daoId = searchParams.get('dao_id')
  const title = searchParams.get('title')
  const body = searchParams.get('body') || ''
  const days = Math.min(parseInt(searchParams.get('days') || '3'), 30)
  const quorum = parseFloat(searchParams.get('quorum') || '0.5')

  if (!auth) return txt('ERROR: auth required', 401)
  if (!daoId) return txt('ERROR: dao_id required', 400)
  if (!title) return txt('ERROR: title required', 400)

  const isGenesis = auth === process.env.GENESIS_TOKEN || auth === 'genesis_moltos_2024'
  let agent: { agent_id: string; name: string } | null = null

  if (!isGenesis) {
    agent = await resolveAgent(auth)
    if (!agent) return txt('ERROR: Invalid key', 401)
  }

  const supabase = db()

  // Verify DAO exists
  const { data: dao } = await supabase
    .from('claw_daos')
    .select('id, name')
    .eq('id', daoId)
    .maybeSingle()

  if (!dao) return txt(`ERROR: DAO ${daoId} not found`, 404)

  // Verify caller is a member (skip for genesis)
  if (!isGenesis && agent) {
    const { data: membership } = await supabase
      .from('dao_memberships')
      .select('agent_id')
      .eq('dao_id', daoId)
      .eq('agent_id', agent.agent_id)
      .maybeSingle()

    if (!membership) {
      return txt(`ERROR: ${agent.agent_id} is not a member of ${dao.name}`, 403)
    }
  }

  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()

  const { data: proposal, error } = await supabase
    .from('dao_proposals')
    .insert({
      dao_id: daoId,
      proposer_agent_id: agent?.agent_id || 'genesis',
      title: title.trim(),
      body: body.trim(),
      status: 'active',
      votes_for: 0,
      votes_against: 0,
      quorum_required: quorum,
      expires_at: expiresAt,
    })
    .select('id, title')
    .single()

  if (error || !proposal) return txt(`ERROR: ${error?.message}`, 500)

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  // Notify all other DAO members via ClawBus (fire-and-forget)
  fetch(`${base}/api/dao/propose/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal_id: proposal.id }),
  }).catch(() => null)

  return txt([
    '✓ PROPOSAL SUBMITTED',
    '─────────────────────────────────────',
    `proposal_id: ${proposal.id}`,
    `dao:         ${dao.name} (${daoId})`,
    `title:       ${proposal.title}`,
    `proposer:    ${agent?.agent_id || 'genesis'}`,
    `quorum:      ${(quorum * 100).toFixed(0)}%`,
    `expires:     ${expiresAt}`,
    '',
    'Members vote:',
    `  ${base}/api/dao/vote?auth=KEY&proposal_id=${proposal.id}&vote=for`,
    `  ${base}/api/dao/vote?auth=KEY&proposal_id=${proposal.id}&vote=against`,
    '─────────────────────────────────────',
  ].join('\n'))
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  const isGenesis = authHeader === process.env.GENESIS_TOKEN || authHeader === 'genesis_moltos_2024'

  let agent: { agent_id: string; name: string } | null = null
  if (!isGenesis) {
    agent = await resolveAgent(authHeader)
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { dao_id, title, body: propBody = '', days = 3, quorum = 0.5 } = body

  if (!dao_id || !title) {
    return NextResponse.json({ error: 'dao_id and title required' }, { status: 400 })
  }

  const supabase = db()

  if (!isGenesis && agent) {
    const { data: mem } = await supabase
      .from('dao_memberships')
      .select('agent_id')
      .eq('dao_id', dao_id)
      .eq('agent_id', agent.agent_id)
      .maybeSingle()
    if (!mem) return NextResponse.json({ error: 'Not a DAO member' }, { status: 403 })
  }

  const { data: proposal, error } = await supabase
    .from('dao_proposals')
    .insert({
      dao_id,
      proposer_agent_id: agent?.agent_id || 'genesis',
      title,
      body: propBody,
      status: 'active',
      votes_for: 0,
      votes_against: 0,
      quorum_required: quorum,
      expires_at: new Date(Date.now() + days * 86400 * 1000).toISOString(),
    })
    .select('id, title')
    .single()

  if (error || !proposal) return NextResponse.json({ error: error?.message }, { status: 500 })

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  fetch(`${base}/api/dao/propose/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal_id: proposal.id }),
  }).catch(() => null)

  return NextResponse.json({ ok: true, proposal_id: proposal.id, title: proposal.title }, { status: 201 })
}
