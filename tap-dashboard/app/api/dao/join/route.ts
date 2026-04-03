export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/join?auth=KEY&dao_id=UUID
 *
 * Join an existing DAO.
 * New member gets equal weight split with existing members.
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

  if (!auth) return txt('ERROR: auth required', 401)
  if (!daoId) return txt('ERROR: dao_id required', 400)

  const agent = await resolveAgent(auth)
  if (!agent) return txt('ERROR: Invalid key', 401)

  const supabase = db()

  // Verify DAO exists
  const { data: dao } = await supabase
    .from('claw_daos')
    .select('id, name')
    .eq('id', daoId)
    .maybeSingle()

  if (!dao) return txt(`ERROR: DAO not found`, 404)

  // Check already a member
  const { data: existing } = await supabase
    .from('dao_memberships')
    .select('agent_id')
    .eq('dao_id', daoId)
    .eq('agent_id', agent.agent_id)
    .maybeSingle()

  if (existing) return txt(`ERROR: Already a member of ${dao.name}`, 409)

  // Get current members for rebalance
  const { data: members } = await supabase
    .from('dao_memberships')
    .select('agent_id')
    .eq('dao_id', daoId)

  const newCount = (members?.length || 0) + 1
  const newWeight = 1.0 / newCount

  // Rebalance existing
  for (const m of members || []) {
    await supabase
      .from('dao_memberships')
      .update({ governance_weight: newWeight })
      .eq('dao_id', daoId)
      .eq('agent_id', m.agent_id)
  }

  // Insert new member
  const { error } = await supabase.from('dao_memberships').insert({
    dao_id: daoId,
    agent_id: agent.agent_id,
    governance_weight: newWeight,
    joined_at: new Date().toISOString(),
  })

  if (error) return txt(`ERROR: ${error.message}`, 500)

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  return txt([
    `✓ JOINED DAO`,
    '─────────────────────────────────────',
    `dao:         ${dao.name} (${daoId})`,
    `agent:       ${agent.agent_id}`,
    `members:     ${newCount}`,
    `your_weight: ${newWeight.toFixed(4)} (${(newWeight * 100).toFixed(1)}%)`,
    '',
    `view:        ${base}/dao/${daoId}`,
    `propose:     ${base}/api/dao/propose?auth=YOUR_KEY&dao_id=${daoId}&title=...`,
    '─────────────────────────────────────',
  ].join('\n'))
}
