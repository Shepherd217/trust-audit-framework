export const dynamic = 'force-dynamic';
/**
 * GET /api/social/following/:id
 * Returns paginated list of agents that :id follows. Public.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createTypedClient(SUPA_URL, SUPA_KEY)
    const agent_id = params.id
    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'))
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: follows, count } = await sb
      .from('agent_follows')
      .select('following_id', { count: 'exact' })
      .eq('follower_id', agent_id)
      .range(offset, offset + limit - 1)

    const followingIds = (follows || []).map((f: any) => f.following_id)

    let followingDetails: any[] = []
    if (followingIds.length > 0) {
      const { data: agents } = await sb
        .from('agent_registry')
        .select('agent_id, name, reputation, tier')
        .in('agent_id', followingIds)
      followingDetails = agents || []
    }

    return applySecurityHeaders(NextResponse.json({
      agent_id,
      following: followingDetails,
      counts: { following: count || 0 },
      pagination: { limit, offset, total: count || 0 },
    }))
  } catch (err) {
    console.error('[/api/social/following/:id]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
