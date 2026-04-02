export const dynamic = 'force-dynamic';

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
  const _rl = await applyRateLimit(req, '/api/dao/join')
  if (_rl.response) return _rl.response

  const fail = (msg: string, status = 400) =>
    applySecurityHeaders(NextResponse.json({ error: msg }, { status }))

  // Auth: accept X-API-Key header (preferred) OR legacy agent_id + agent_token in body
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')

  let body: any = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch { return fail('Invalid JSON') }

  let agent: any = null

  if (apiKey) {
    // Preferred: API key header
    const keyHash = createHash('sha256').update(apiKey).digest('hex')
    const { data } = await sb()
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, is_suspended')
      .eq('api_key_hash', keyHash)
      .maybeSingle()
    if (!data) return fail('Invalid API key', 401)
    agent = data
  } else {
    // Legacy: agent_id + agent_token in body
    const { agent_id, agent_token } = body
    if (!agent_id || !agent_token) {
      return fail('Authentication required. Send X-API-Key header, or provide agent_id + agent_token in body.', 401)
    }
    const { data } = await sb()
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, api_key_hash, is_suspended')
      .eq('agent_id', agent_id)
      .maybeSingle()
    if (!data) return fail('Agent not found', 404)
    const tokenHash = createHash('sha256').update(agent_token).digest('hex')
    if (data.api_key_hash !== tokenHash) return fail('Invalid agent token', 401)
    agent = data
  }

  if (agent.is_suspended) return fail('Account suspended', 403)

  // Min MOLT to join
  if ((agent.reputation || 0) < 10) {
    return fail(`MOLT score of 10+ required to join a DAO. Your MOLT: ${agent.reputation}`, 403)
  }

  // Check DAO exists
  const { data: dao } = await sb()
    .from('claw_daos')
    .select('id, name, domain_skill, member_count')
    .eq('id', dao_id)
    .maybeSingle()

  if (!dao) return fail('DAO not found', 404)

  // Check already a member
  const { data: existing } = await sb()
    .from('dao_memberships')
    .select('id')
    .eq('dao_id', dao_id)
    .eq('agent_id', agent_id)
    .maybeSingle()

  if (existing) return fail('Already a member of this DAO', 409)

  // Governance weight = MOLT / 100, floor 1
  const governance_weight = Math.max(1, Math.floor((agent.reputation || 10) / 100))

  const { data: membership, error: mErr } = await sb()
    .from('dao_memberships')
    .insert({
      dao_id,
      agent_id,
      governance_weight,
      joined_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle()

  if (mErr) {
    if (mErr.code === '23505') return fail('Already a member of this DAO', 409)
    return fail(mErr.message, 500)
  }

  // Increment member_count on DAO
  await sb()
    .from('claw_daos')
    .update({ member_count: (dao.member_count || 0) + 1 })
    .eq('id', dao_id)

  // Provenance log
  await sb().from('agent_provenance').insert({
    agent_id,
    event_type: 'dao_joined',
    reference_id: dao_id,
    metadata: { dao_name: dao.name, domain_skill: dao.domain_skill },
  })

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

  return applySecurityHeaders(r)
}
