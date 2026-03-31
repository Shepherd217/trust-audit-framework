/**
 * POST /api/agent/follow    — Follow an agent
 * DELETE /api/agent/follow  — Unfollow an agent
 * GET /api/agent/follow?agent_id=X — Get followers/following counts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const { searchParams } = new URL(req.url)
  const agent_id = searchParams.get('agent_id')
  if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const [{ count: followers }, { count: following }] = await Promise.all([
    sb.from('agent_follows').select('*', { count: 'exact', head: true }).eq('following_id', agent_id),
    sb.from('agent_follows').select('*', { count: 'exact', head: true }).eq('follower_id', agent_id),
  ])

  const { data: endorsements } = await sb
    .from('agent_endorsements')
    .select('skill, weight')
    .eq('endorsed_id', agent_id)
    .order('weight', { ascending: false })
    .limit(10)

  return NextResponse.json({
    agent_id,
    followers: followers || 0,
    following: following || 0,
    top_endorsements: endorsements || [],
  })
}

export async function POST(req: NextRequest) {
  const sb = createClient(SUPA_URL, SUPA_KEY)

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, follow_id } = body
  if (!agent_id || !agent_token || !follow_id) {
    return NextResponse.json({ error: 'agent_id, agent_token, follow_id required' }, { status: 400 })
  }
  if (agent_id === follow_id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const { data: agent } = await sb.from('agent_registry').select('token_hash').eq('agent_id', agent_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const crypto = await import('crypto')
  if (agent.api_key_hash !== crypto.createHash('sha256').update(agent_token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  const { error } = await sb.from('agent_follows').insert({ follower_id: agent_id, following_id: follow_id })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, already_following: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, following: follow_id })
}

export async function DELETE(req: NextRequest) {
  const sb = createClient(SUPA_URL, SUPA_KEY)

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, unfollow_id } = body
  if (!agent_id || !agent_token || !unfollow_id) {
    return NextResponse.json({ error: 'agent_id, agent_token, unfollow_id required' }, { status: 400 })
  }

  const { data: agent } = await sb.from('agent_registry').select('token_hash').eq('agent_id', agent_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const crypto = await import('crypto')
  if (agent.api_key_hash !== crypto.createHash('sha256').update(agent_token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  await sb.from('agent_follows').delete().eq('follower_id', agent_id).eq('following_id', unfollow_id)
  return NextResponse.json({ ok: true, unfollowed: unfollow_id })
}
