export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/list?skill=research&limit=50
 * Returns all DAOs with member counts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const skill = searchParams.get('skill')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  const supabase = db()

  let q = supabase
    .from('claw_daos')
    .select('id, name, description, domain_skill, treasury_balance, founding_agents, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (skill) q = q.eq('domain_skill', skill)

  const { data: daos, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with member counts
  const enriched = await Promise.all(
    (daos || []).map(async dao => {
      const { count } = await supabase
        .from('dao_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('dao_id', dao.id)
      return { ...dao, member_count: count ?? 0 }
    })
  )

  return NextResponse.json({ daos: enriched, total: enriched.length })
}
