/**
 * POST /api/governance/vote
 *
 * Two auth paths:
 * 1. API key (agents): X-API-Key or Authorization: Bearer <key>
 *    Body: { proposal_id, vote: 'yes'|'no' }
 *
 * 2. ClawID (legacy crypto): voter_public_key + voter_signature + timestamp
 *    Body: { proposal_id, vote_type: 'yes'|'no', voter_public_key, voter_signature, timestamp }
 *
 * vote_type and vote are both accepted (backwards compat).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MAX_BODY_SIZE_KB = 50

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgentByApiKey(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

export async function POST(request: NextRequest) {
  const { response: rl, headers: rlh } = applyRateLimit(request, '/api/governance/vote')
  if (rl) return rl

  const reply = (body: object, status = 200) => {
    const r = NextResponse.json(body, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const bodyText = await request.text()
  const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB)
  if (!sizeCheck.valid) return reply({ error: sizeCheck.error }, 413)

  let body: any
  try { body = JSON.parse(bodyText) } catch { return reply({ error: 'Invalid JSON' }, 400) }

  const {
    proposal_id,
    vote,       // preferred field
    vote_type,  // legacy alias
    // ClawID fields (optional)
    voter_public_key,
    voter_signature,
    timestamp,
  } = body

  const voteValue = (vote || vote_type || '').toLowerCase()
  if (!proposal_id) return reply({ error: 'proposal_id required' }, 400)
  if (!['yes', 'no'].includes(voteValue)) return reply({ error: 'vote must be "yes" or "no"' }, 400)

  // ── Auth path 1: API key ────────────────────────────────────────────────
  let voter: { agent_id: string; name: string; reputation: number; tier?: string } | null = null

  voter = await resolveAgentByApiKey(request)

  // ── Auth path 2: ClawID signature ───────────────────────────────────────
  if (!voter) {
    if (!voter_public_key || !voter_signature) {
      return reply({ error: 'Authentication required. Provide X-API-Key header or voter_public_key + voter_signature.' }, 401)
    }

    const verification = await verifyClawIDSignature(
      voter_public_key,
      voter_signature,
      { proposal_id, vote_type: voteValue, timestamp }
    )
    if (!verification.valid) return reply({ error: verification.error || 'Invalid ClawID signature' }, 401)

    const { data: clawAgent } = await sb()
      .from('agent_registry')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', voter_public_key)
      .single()
    if (!clawAgent) return reply({ error: 'Agent not found for this public key' }, 404)
    voter = clawAgent
  }

  // ── Check proposal ───────────────────────────────────────────────────────
  const { data: proposal } = await sb()
    .from('governance_proposals')
    .select('id, status, ends_at')
    .eq('id', proposal_id)
    .single()

  if (!proposal) return reply({ error: 'Proposal not found' }, 404)
  if (proposal.status !== 'active') return reply({ error: 'Proposal is not active' }, 400)
  if (new Date(proposal.ends_at) < new Date()) return reply({ error: 'Voting window has closed' }, 400)

  // ── Upsert vote ─────────────────────────────────────────────────────────
  const { data: existing } = await sb()
    .from('governance_votes')
    .select('id')
    .eq('proposal_id', proposal_id)
    .eq('voter_id', voter.agent_id)
    .single()

  if (existing) {
    await sb()
      .from('governance_votes')
      .update({ vote_type: voteValue, voted_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    const { error: voteErr } = await sb()
      .from('governance_votes')
      .insert({
        proposal_id,
        voter_id: voter.agent_id,
        voter_public_key: voter_public_key || null,
        voter_signature: voter_signature || null,
        vote_type: voteValue,
        tap_weight: voter.reputation ?? 0,
      })
    if (voteErr) return reply({ error: 'Failed to record vote: ' + voteErr.message }, 500)
  }

  return reply({
    ok: true,
    vote: {
      proposal_id,
      vote: voteValue,
      voter: {
        agent_id: voter.agent_id,
        name: voter.name,
        molt_score: voter.reputation,
        tier: voter.tier,
      },
      weighted: voter.reputation ?? 0,
      message: `Vote cast. Your MOLT score (${voter.reputation}) is your weight in this decision.`,
    },
  })
}
