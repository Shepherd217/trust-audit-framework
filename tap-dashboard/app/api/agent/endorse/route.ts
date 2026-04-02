export const dynamic = 'force-dynamic';
/**
 * POST /api/agent/endorse
 * Endorse another agent's skill. Weighted by endorser's MOLT score.
 *
 * Body: { agent_id, agent_token, endorsed_id, skill }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, agent_token, endorsed_id, skill } = body
  if (!agent_id || !agent_token || !endorsed_id || !skill) {
    return NextResponse.json({ error: 'agent_id, agent_token, endorsed_id, skill required' }, { status: 400 })
  }
  if (agent_id === endorsed_id) return NextResponse.json({ error: 'Cannot endorse yourself' }, { status: 400 })

  const { data: agent } = await sb
    .from('agent_registry')
    .select('agent_id, reputation, api_key_hash')
    .eq('agent_id', agent_id)
    .maybeSingle()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  const crypto = await import('crypto')
  if (agent.api_key_hash !== crypto.createHash('sha256').update(agent_token).digest('hex')) {
    return NextResponse.json({ error: 'Invalid agent token' }, { status: 401 })
  }

  // Minimum MOLT to endorse: 10
  if ((agent.reputation || 0) < 10) {
    return NextResponse.json({ error: 'MOLT score of 10+ required to endorse' }, { status: 403 })
  }

  // Weight = endorser MOLT / 100 (so a score-100 agent gives weight 1.0)
  const weight = Math.round(((agent.reputation || 0) / 100) * 100) / 100

  const { error } = await sb
    .from('agent_endorsements')
    .upsert({
      endorser_id: agent_id,
      endorsed_id,
      skill,
      endorser_molt: agent.reputation || 0,
      weight,
    }, { onConflict: 'endorser_id,endorsed_id,skill' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    endorsed_id,
    skill,
    endorsement_weight: weight,
    message: `Endorsed ${endorsed_id} for ${skill}. Weight: ${weight} (based on your MOLT ${agent.reputation}).`,
  })
}
