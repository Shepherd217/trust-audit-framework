export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/create?auth=KEY&name=NAME&skill=SKILL&agents=id1,id2,id3
 *
 * Found a DAO. Caller must be an active agent or genesis.
 * Listed agents become founding members with equal governance weight.
 * Also inserts into dao_memberships for each founding agent.
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
    .select('agent_id, name, reputation, tier')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auth = searchParams.get('auth')
  const name = searchParams.get('name')
  const skill = searchParams.get('skill') || 'general'
  const agentsParam = searchParams.get('agents') // comma-separated agent IDs
  const description = searchParams.get('description') || ''

  if (!auth) return txt('ERROR: auth required', 401)
  if (!name) return txt('ERROR: name required — ?name=MyDAO', 400)

  const isGenesis = auth === process.env.GENESIS_TOKEN || auth === 'genesis_moltos_2024'
  let caller: { agent_id: string; name: string; reputation: number; tier: string } | null = null

  if (!isGenesis) {
    caller = await resolveAgent(auth)
    if (!caller) return txt('ERROR: Invalid key', 401)
  }

  const supabase = db()

  // Parse founding agents
  const rawAgents = agentsParam ? agentsParam.split(',').map(s => s.trim()).filter(Boolean) : []
  // Always include caller if they're an agent
  const foundingIds = caller
    ? [...new Set([caller.agent_id, ...rawAgents])]
    : [...new Set(rawAgents)]

  if (foundingIds.length < 1) {
    return txt('ERROR: at least one founding agent required (caller counts)', 400)
  }

  // Verify all provided agent IDs exist
  if (rawAgents.length > 0) {
    const { data: found } = await supabase
      .from('agent_registry')
      .select('agent_id, name')
      .in('agent_id', rawAgents)

    const foundIds = (found || []).map(a => a.agent_id)
    const missing = rawAgents.filter(id => !foundIds.includes(id))
    if (missing.length > 0) {
      return txt(`ERROR: unknown agent IDs: ${missing.join(', ')}`, 400)
    }
  }

  // Create the DAO
  const weight = 1.0 / foundingIds.length

  const { data: dao, error: daoErr } = await supabase
    .from('claw_daos')
    .insert({
      name: name.trim(),
      description: description.trim() || `${name} — founded by ${foundingIds.length} agent(s)`,
      domain_skill: skill,
      treasury_balance: 0,
      founding_agents: foundingIds,
    })
    .select('id, name')
    .single()

  if (daoErr || !dao) {
    return txt(`ERROR: DAO creation failed: ${daoErr?.message}`, 500)
  }

  // Add all founding agents as members
  const memberships = foundingIds.map(agent_id => ({
    dao_id: dao.id,
    agent_id,
    governance_weight: weight,
    joined_at: new Date().toISOString(),
  }))

  const { error: memErr } = await supabase.from('dao_memberships').insert(memberships)
  if (memErr) {
    // Non-fatal — DAO is created, memberships failed
    return txt(
      [
        '⚠ DAO created but membership insert failed',
        `dao_id:   ${dao.id}`,
        `name:     ${dao.name}`,
        `skill:    ${skill}`,
        `founders: ${foundingIds.join(', ')}`,
        `error:    ${memErr.message}`,
      ].join('\n'),
      207
    )
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  return txt(
    [
      '✓ DAO FOUNDED',
      '─────────────────────────────────────',
      `dao_id:      ${dao.id}`,
      `name:        ${dao.name}`,
      `skill:       ${skill}`,
      `founders:    ${foundingIds.length}`,
      `  ${foundingIds.join('\n  ')}`,
      `gov_weight:  ${weight.toFixed(4)} each`,
      '',
      `view:        ${base}/api/dao/${dao.id}`,
      '─────────────────────────────────────',
      'Next: POST a proposal via /api/dao/propose',
    ].join('\n')
  )
}

export async function POST(req: NextRequest) {
  // JSON body version for programmatic use
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  const isGenesis = authHeader === process.env.GENESIS_TOKEN || authHeader === 'genesis_moltos_2024'

  let caller: { agent_id: string; name: string } | null = null
  if (!isGenesis) {
    caller = await resolveAgent(authHeader)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { name, skill = 'general', agents = [], description = '' } = body

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = db()
  const foundingIds: string[] = caller
    ? [...new Set([caller.agent_id, ...(agents as string[])])]
    : [...new Set(agents as string[])]

  const weight = 1.0 / Math.max(foundingIds.length, 1)

  const { data: dao, error } = await supabase
    .from('claw_daos')
    .insert({
      name,
      description: description || `${name} DAO`,
      domain_skill: skill,
      treasury_balance: 0,
      founding_agents: foundingIds,
    })
    .select('id, name')
    .single()

  if (error || !dao) return NextResponse.json({ error: error?.message }, { status: 500 })

  await supabase.from('dao_memberships').insert(
    foundingIds.map(agent_id => ({ dao_id: dao.id, agent_id, governance_weight: weight }))
  )

  return NextResponse.json({ ok: true, dao_id: dao.id, name: dao.name, founders: foundingIds }, { status: 201 })
}
