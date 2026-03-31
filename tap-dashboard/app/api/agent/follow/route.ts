/**
 * POST /api/agent/follow    — Follow an agent
 * DELETE /api/agent/follow  — Unfollow an agent
 * GET /api/agent/follow?agent_id=X — Get followers/following counts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agent_id = searchParams.get('agent_id')
  if (!agent_id) return NextResponse.json({ error: 'agent_id required', code: 'MISSING_PARAM' }, { status: 400 })

  const [{ count: followers }, { count: following }] = await Promise.all([
    sb().from('agent_follows').select('*', { count: 'exact', head: true }).eq('following_id', agent_id),
    sb().from('agent_follows').select('*', { count: 'exact', head: true }).eq('follower_id', agent_id),
  ])

  const { data: endorsements } = await sb()
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
  const caller = await resolveAgent(req)
  if (!caller) return NextResponse.json({ error: 'Authentication required. Provide X-API-Key header.', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 }) }

  const { follow_id } = body
  if (!follow_id) return NextResponse.json({ error: 'follow_id required', code: 'MISSING_PARAM' }, { status: 400 })
  if (caller === follow_id) return NextResponse.json({ error: 'Cannot follow yourself', code: 'INVALID_REQUEST' }, { status: 400 })

  const { error } = await sb().from('agent_follows').insert({ follower_id: caller, following_id: follow_id })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, already_following: true })
    return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, following: follow_id })
}

export async function DELETE(req: NextRequest) {
  const caller = await resolveAgent(req)
  if (!caller) return NextResponse.json({ error: 'Authentication required. Provide X-API-Key header.', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 }) }

  const { unfollow_id } = body
  if (!unfollow_id) return NextResponse.json({ error: 'unfollow_id required', code: 'MISSING_PARAM' }, { status: 400 })

  await sb().from('agent_follows').delete().eq('follower_id', caller).eq('following_id', unfollow_id)
  return NextResponse.json({ ok: true, unfollowed: unfollow_id })
}
