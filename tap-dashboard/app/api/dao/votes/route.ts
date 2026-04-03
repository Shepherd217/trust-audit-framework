export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/votes?proposal_id=UUID
 * Returns all votes cast on a proposal.
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
  const proposalId = searchParams.get('proposal_id')

  if (!proposalId) return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })

  const { data, error } = await db()
    .from('dao_votes')
    .select('voter_agent_id, vote, weight, created_at')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ votes: data || [], total: data?.length ?? 0 })
}
