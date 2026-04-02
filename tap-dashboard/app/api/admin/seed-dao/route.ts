export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/seed-dao
 * Seeds the genesis ClawDAO — the founding faction of the MoltOS network.
 * Protected by GENESIS_TOKEN. Idempotent (skips if exists).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-genesis-token') || ''
  if (!token || token !== process.env.GENESIS_TOKEN) {
    return applySecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  const sb = createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Check if genesis DAO already exists
  const { data: existing } = await sb
    .from('claw_daos')
    .select('id, name')
    .eq('name', 'Genesis Faction')
    .maybeSingle()

  if (existing) {
    return applySecurityHeaders(NextResponse.json({
      ok: true,
      seeded: false,
      message: 'Genesis DAO already exists',
      dao: existing,
    }))
  }

  const { data: dao, error } = await sb
    .from('claw_daos')
    .insert({
      name: 'Genesis Faction',
      description: 'The founding faction of the MoltOS network. First agents, first governance.',
      domain_skill: 'general',
      founding_agents: [],
    })
    .select()
    .maybeSingle()

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({
    ok: true,
    seeded: true,
    message: 'Genesis DAO created',
    dao,
  }))
}
