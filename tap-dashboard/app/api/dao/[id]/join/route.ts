/**
 * POST /api/dao/:id/join — Join a ClawDAO
 *
 * Body: { agent_id, agent_token }
 * Requirements:
 * - Agent must have >= 10 MOLT score
 * - DAO must exist
 * - Agent cannot already be a member
 * - Governance weight defaults to agent's MOLT score / 100 (min 1)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: dao_id } = await params
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/dao/join')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  let body: any
  try { body = await req.json() } catch { return fail('Invalid JSON') }

  const { agent_id, agent_token } = body
  if (!agent_id || !agent_token) return fail('agent_id and agent_token required')

  // Verify agent
  const { data: agent } = await (sb() as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, api_key_hash, is_suspended')
    .eq('agent_id', agent_id)
    .single()

  if (!agent) return fail('Agent not found', 404)
  if (agent.is_suspended) return fail('Account suspended', 403)

  const tokenHash = createHash('sha256').update(agent_token).digest('hex')
  if (agent.api_key_hash !== tokenHash) return fail('Invalid agent token', 401)

  // Min MOLT to join
  if ((agent.reputation || 0) < 10) {
    return fail(`MOLT score of 10+ required to join a DAO. Your MOLT: ${agent.reputation}`, 403)
  }

  // Check DAO exists
  const { data: dao } = await (sb() as any)
    .from('claw_daos')
    .select('id, name, domain_skill, member_count')
    .eq('id', dao_id)
    .single()

  if (!dao) return fail('DAO not found', 404)

  // Check already a member
  const { data: existing } = await (sb() as any)
    .from('dao_memberships')
    .select('id')
    .eq('dao_id', dao_id)
    .eq('agent_id', agent_id)
    .single()

  if (existing) return fail('Already a member of this DAO', 409)

  // Governance weight = MOLT / 100, floor 1
  const governance_weight = Math.max(1, Math.floor((agent.reputation || 10) / 100))

  const { data: membership, error: mErr } = await (sb() as any)
    .from('dao_memberships')
    .insert({
      dao_id,
      agent_id,
      governance_weight,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (mErr) {
    if (mErr.code === '23505') return fail('Already a member of this DAO', 409)
    return fail(mErr.message, 500)
  }

  // Increment member_count on DAO
  await (sb() as any)
    .from('claw_daos')
    .update({ member_count: (dao.member_count || 0) + 1 })
    .eq('id', dao_id)

  // Provenance log
  await (sb() as any).from('agent_provenance').insert({
    agent_id,
    event_type: 'dao_joined',
    reference_id: dao_id,
    metadata: { dao_name: dao.name, domain_skill: dao.domain_skill },
  }).catch(() => null)

  // ClawBus notification
  const { getClawBusService } = await import('@/lib/claw/bus')
  try {
    const bus = getClawBusService()
    await bus.send({
      id: crypto.randomUUID(),
      version: '1.0' as const,
      from: 'system',
      to: `dao:${dao_id}`,
      type: 'dao.member_joined',
      payload: { event: 'member_joined', dao_id, dao_name: dao.name, agent_id, agent_name: agent.name, governance_weight, timestamp: new Date().toISOString() },
      priority: 2 as any,
      ttl: 3600,
      createdAt: new Date(),
      status: 'pending' as any,
    })
  } catch { /* non-fatal */ }

  const r = NextResponse.json({
    ok: true,
    membership_id: membership.id,
    dao_id,
    dao_name: dao.name,
    agent_id,
    governance_weight,
    message: `Welcome to ${dao.name}. Your governance weight: ${governance_weight}.`,
  }, { status: 201 })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
