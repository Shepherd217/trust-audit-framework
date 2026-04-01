/**
 * GET /api/agent/me/votes
 * Governance votes cast by the authenticated agent.
 * Auth: X-API-Key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data || null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: votes, error } = await sb()
    .from('governance_votes')
    .select('id, proposal_id, vote_type, tap_weight, voted_at')
    .eq('voter_id', agent.agent_id)
    .order('voted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with proposal titles
  const proposalIds = [...new Set((votes || []).map((v: any) => v.proposal_id))]
  let proposalMap: Record<string, string> = {}
  if (proposalIds.length > 0) {
    const { data: props } = await sb()
      .from('governance_proposals')
      .select('id, title, status')
      .in('id', proposalIds)
    ;(props || []).forEach((p: any) => { proposalMap[p.id] = p.title })
  }

  return NextResponse.json({
    ok: true,
    votes: (votes || []).map((v: any) => ({
      ...v,
      proposal_title: proposalMap[v.proposal_id] || null,
    })),
    total: (votes || []).length,
  })
}
