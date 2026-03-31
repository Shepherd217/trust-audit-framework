/**
 * ClawDAO routes
 *
 * POST /api/dao         — Create a new DAO
 * GET  /api/dao         — List all DAOs (paginated)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const { searchParams } = new URL(req.url)
  const skill = searchParams.get('skill')
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = sb.from('claw_daos').select('*', { count: 'exact' })
  if (skill) query = query.eq('domain_skill', skill)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ daos: data || [], total: count, offset, limit })
}

export async function POST(req: NextRequest) {
  const sb = createClient(SUPA_URL, SUPA_KEY)

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, name, description, domain_skill, co_founders = [] } = body

  if (!agent_id || !agent_token || !name) {
    return NextResponse.json({ error: 'agent_id, agent_token, name required' }, { status: 400 })
  }

  // Verify agent
  const { data: agent } = await sb
    .from('agents')
    .select('id, reputation, token_hash')
    .eq('id', agent_id)
    .single()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const crypto = await import('crypto')
  const tokenHash = crypto.createHash('sha256').update(agent_token).digest('hex')
  if (agent.token_hash !== tokenHash) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  // Minimum MOLT to found a DAO: 30
  if ((agent.reputation || 0) < 30) {
    return NextResponse.json({ error: 'MOLT score of 30+ required to found a DAO' }, { status: 403 })
  }

  // Create DAO
  const founding_agents = [agent_id, ...co_founders.filter((id: string) => id !== agent_id)]
  const { data: dao, error: dErr } = await sb
    .from('claw_daos')
    .insert({ name, description: description || '', domain_skill: domain_skill || null, founding_agents })
    .select()
    .single()

  if (dErr) {
    if (dErr.code === '23505') return NextResponse.json({ error: 'DAO name already taken' }, { status: 409 })
    return NextResponse.json({ error: dErr.message }, { status: 500 })
  }

  // Add founder as first member with weight 1.0
  await sb.from('dao_memberships').insert({
    dao_id: dao.id,
    agent_id,
    governance_weight: 1.0,
  })

  // Add co-founders with weight 0.5 each (to be recalculated on first vote)
  for (const co of co_founders.filter((id: string) => id !== agent_id)) {
    await sb.from('dao_memberships').insert({
      dao_id: dao.id,
      agent_id: co,
      governance_weight: 0.5,
    }).catch(() => null)
  }

  return NextResponse.json({
    ok: true,
    dao_id: dao.id,
    name: dao.name,
    domain_skill: dao.domain_skill,
    founding_agents,
    message: `ClawDAO "${name}" created. Agents who judge well together now govern together.`,
  })
}
