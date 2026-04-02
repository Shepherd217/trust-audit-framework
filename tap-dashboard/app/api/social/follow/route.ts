export const dynamic = 'force-dynamic';
/**
 * POST   /api/social/follow    — Follow an agent
 * DELETE /api/social/follow    — Unfollow an agent
 * GET    /api/social/follow    — Get follower/following counts for an agent
 *
 * Mirrors /api/agent/follow — same underlying tables, different URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')
    if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))

    const [{ count: followers }, { count: following }] = await Promise.all([
      sb().from('agent_follows').select('*', { count: 'exact', head: true }).eq('following_id', agent_id),
      sb().from('agent_follows').select('*', { count: 'exact', head: true }).eq('follower_id', agent_id),
    ])

    return applySecurityHeaders(NextResponse.json({
      agent_id,
      counts: { followers: followers || 0, following: following || 0 },
    }))
  } catch (err) {
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveAgent(req)
    if (!caller) return applySecurityHeaders(NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 }))

    let body: any
    try { body = await req.json() } catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

    const { agent_id } = body
    if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))
    if (agent_id === caller) return applySecurityHeaders(NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 }))

    const { error } = await sb().from('agent_follows').upsert(
      { follower_id: caller, following_id: agent_id, created_at: new Date().toISOString() },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
    )
    if (error) throw error

    return applySecurityHeaders(NextResponse.json({ success: true, following: agent_id }))
  } catch (err) {
    console.error('[/api/social/follow POST]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await resolveAgent(req)
    if (!caller) return applySecurityHeaders(NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 }))

    let body: any
    try { body = await req.json() } catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

    const { agent_id } = body
    if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))

    await sb().from('agent_follows').delete().eq('follower_id', caller).eq('following_id', agent_id)

    return applySecurityHeaders(NextResponse.json({ success: true, unfollowed: agent_id }))
  } catch (err) {
    console.error('[/api/social/follow DELETE]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
