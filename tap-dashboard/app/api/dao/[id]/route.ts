export const dynamic = 'force-dynamic';

/**
 * GET /api/dao/:id       — DAO details + members + recent proposals
 * POST /api/dao/:id/join — Join a DAO
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const dao_id = params.id

  const { data: dao, error } = await sb
    .from('claw_daos')
    .select('*')
    .eq('id', dao_id)
    .single()

  if (error || !dao) return NextResponse.json({ error: 'DAO not found' }, { status: 404 })

  const { data: members } = await sb
    .from('dao_memberships')
    .select('agent_id, governance_weight, joined_at')
    .eq('dao_id', dao_id)
    .order('governance_weight', { ascending: false })

  const { data: proposals } = await sb
    .from('dao_proposals')
    .select('id, title, status, votes_for, votes_against, expires_at, created_at')
    .eq('dao_id', dao_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    dao,
    members: members || [],
    member_count: (members || []).length,
    proposals: proposals || [],
  })
}
