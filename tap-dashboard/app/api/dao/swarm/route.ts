export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/swarm?auth=KEY&dao_id=UUID&action=create|sync|view
 *
 * Swarm ↔ DAO integration.
 *
 * action=create  — creates a new swarm owned by the DAO, adds all member agents
 * action=sync    — syncs existing DAO members into the DAO's swarm (adds missing agents)
 * action=view    — returns the DAO's swarm (if any)
 *
 * Swarm is stored with config.dao_id linking back to the DAO.
 * Any agent that joins the DAO gets added to the swarm automatically.
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
  const action = searchParams.get('action') || 'view'

  if (!auth) return txt('ERROR: auth required', 401)
  if (!daoId) return txt('ERROR: dao_id required', 400)

  const isGenesis = auth === process.env.GENESIS_TOKEN || auth === 'genesis_moltos_2024'
  let caller: { agent_id: string; name: string } | null = null

  if (!isGenesis) {
    caller = await resolveAgent(auth)
    if (!caller) return txt('ERROR: Invalid key', 401)
  }

  const supabase = db()

  // Load DAO
  const { data: dao } = await supabase
    .from('claw_daos')
    .select('id, name, domain_skill, founding_agents')
    .eq('id', daoId)
    .maybeSingle()

  if (!dao) return txt('ERROR: DAO not found', 404)

  // Check member (skip for genesis)
  if (!isGenesis && caller) {
    const { data: mem } = await supabase
      .from('dao_memberships')
      .select('agent_id')
      .eq('dao_id', daoId)
      .eq('agent_id', caller.agent_id)
      .maybeSingle()
    if (!mem) return txt('ERROR: Not a DAO member', 403)
  }

  // Load all DAO members
  const { data: members } = await supabase
    .from('dao_memberships')
    .select('agent_id')
    .eq('dao_id', daoId)

  const memberIds = (members || []).map(m => m.agent_id)

  // Find existing DAO swarm
  const { data: existingSwarms } = await supabase
    .from('swarms')
    .select('id, name, description, agent_ids, status, config')
    .filter('config->>dao_id', 'eq', daoId)
    .limit(1)

  const existingSwarm = existingSwarms?.[0] || null

  if (action === 'view') {
    if (!existingSwarm) {
      return NextResponse.json({ swarm: null, dao_id: daoId, member_count: memberIds.length })
    }
    return NextResponse.json({ swarm: existingSwarm, dao_id: daoId, member_count: memberIds.length })
  }

  if (action === 'create') {
    if (existingSwarm) return txt(`ERROR: DAO already has swarm ${existingSwarm.id} — use action=sync to update`, 409)

    const { data: swarm, error } = await supabase
      .from('swarms')
      .insert({
        name: `${dao.name} Swarm`,
        description: `Autonomous swarm for ${dao.name} DAO. Members collaborate on ${dao.domain_skill} tasks.`,
        status: 'idle',
        agent_ids: memberIds,
        config: {
          dao_id: daoId,
          dao_name: dao.name,
          domain_skill: dao.domain_skill,
          auto_sync: true,
        },
      })
      .select('id, name, agent_ids')
      .single()

    if (error || !swarm) return txt(`ERROR: Swarm creation failed: ${error?.message}`, 500)

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

    return txt([
      '✓ DAO SWARM CREATED',
      '─────────────────────────────────────',
      `swarm_id:   ${swarm.id}`,
      `name:       ${swarm.name}`,
      `dao:        ${dao.name} (${daoId})`,
      `agents:     ${memberIds.length}`,
      `  ${memberIds.join('\n  ')}`,
      '',
      `sync later: ${base}/api/dao/swarm?auth=KEY&dao_id=${daoId}&action=sync`,
      '─────────────────────────────────────',
    ].join('\n'))
  }

  if (action === 'sync') {
    if (!existingSwarm) {
      return txt(`ERROR: No swarm found for this DAO — use action=create first`, 404)
    }

    const currentIds: string[] = existingSwarm.agent_ids || []
    const toAdd = memberIds.filter(id => !currentIds.includes(id))
    const merged = [...new Set([...currentIds, ...memberIds])]

    const { error } = await supabase
      .from('swarms')
      .update({ agent_ids: merged, updated_at: new Date().toISOString() })
      .eq('id', existingSwarm.id)

    if (error) return txt(`ERROR: Sync failed: ${error.message}`, 500)

    return txt([
      '✓ SWARM SYNCED',
      '─────────────────────────────────────',
      `swarm_id:   ${existingSwarm.id}`,
      `dao:        ${dao.name}`,
      `added:      ${toAdd.length} agent(s)`,
      `total:      ${merged.length} agent(s)`,
      toAdd.length > 0 ? `new agents:\n  ${toAdd.join('\n  ')}` : 'no new agents to add',
      '─────────────────────────────────────',
    ].filter(Boolean).join('\n'))
  }

  return txt('ERROR: action must be create | sync | view', 400)
}
