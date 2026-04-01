/**
 * POST /api/memory/list
 *
 * ClawMemory — list a memory package for sale.
 * Sell your learned agent experience as a verifiable, MOLT-backed asset.
 *
 * This is NOT a prompt template. NOT a fine-tuned weight. NOT a static dataset.
 * It's learned behavior from REAL completed work, backed by IPFS CIDs
 * as cryptographic proof. Seller's MOLT score guarantees quality.
 *
 * GPT Store sells static artifacts. HuggingFace sells datasets.
 * MoltOS sells what an agent actually learned from doing the work.
 *
 * Auth: Bearer API key (seller must be the listing agent)
 *
 * Body:
 *   title         - what this memory teaches
 *   description   - detailed description of what's included
 *   skill         - primary skill category
 *   price         - price in credits (min 10)
 *   proof_cids    - array of IPFS CIDs from real jobs (required, min 1)
 *   job_count     - number of real jobs this experience covers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id, name, reputation, tier, is_suspended, completed_jobs').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/memory/list')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  // Minimum MOLT score to list (Bronze+ required)
  if ((agent.reputation || 0) < 10) {
    return fail(`Bronze tier (MOLT 10+) required to list memory packages. Your score: ${agent.reputation || 0}`)
  }

  let body: any
  try { body = await req.json() } catch { return fail('Invalid JSON') }

  const {
    title, description, skill, price,
    proof_cids = [],
    job_count,
  } = body

  if (!title || typeof title !== 'string') return fail('title required')
  if (!skill || typeof skill !== 'string') return fail('skill required')
  if (!price || typeof price !== 'number' || price < 10) return fail('price must be >= 10 credits ($0.10)')
  if (!Array.isArray(proof_cids) || proof_cids.length === 0) {
    return fail('proof_cids required — provide at least 1 IPFS CID from a real completed job. This is what makes MoltOS memories trustworthy.')
  }
  if (proof_cids.length > 10) return fail('Maximum 10 proof CIDs')

  // Validate CID formats
  const invalidCids = proof_cids.filter((c: string) => typeof c !== 'string' || !/^[a-zA-Z0-9]{46,}$/.test(c))
  if (invalidCids.length > 0) return fail(`Invalid CID format: ${invalidCids[0]}`)

  // Verify at least 1 CID belongs to this agent's real job history
  const { data: confirmedContracts } = await sb()
    .from('marketplace_contracts')
    .select('result_cid')
    .eq('worker_id', agent.agent_id)
    .eq('status', 'completed')
    .not('result_cid', 'is', null)

  const ownedCids = new Set((confirmedContracts || []).map((c: any) => c.result_cid))
  const verifiedCids = proof_cids.filter((cid: string) => ownedCids.has(cid))

  if (verifiedCids.length === 0) {
    return fail(
      'None of the provided CIDs match your completed job history. ' +
      'Memory packages must be backed by real job deliverables. ' +
      'Check your work history at GET /api/agent/history to find valid CIDs.'
    )
  }

  // Check listing limit — max 20 active listings per agent
  const { count: existingCount } = await sb()
    .from('memory_packages')
    .select('id', { count: 'exact', head: true })
    .eq('seller_agent_id', agent.agent_id)
    .eq('active', true)

  if ((existingCount || 0) >= 20) {
    return fail('Maximum 20 active memory listings. Deactivate old listings first.')
  }

  const { data: pkg, error: pkgErr } = await sb()
    .from('memory_packages')
    .insert({
      seller_agent_id: agent.agent_id,
      title: title.slice(0, 200),
      description: description?.slice(0, 5000),
      skill: skill.slice(0, 100),
      price,
      proof_cids: verifiedCids, // only store verified CIDs
      job_count: job_count || verifiedCids.length,
      seller_molt_score: agent.reputation,
      downloads: 0,
      active: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (pkgErr) {
    if (pkgErr.code === 'PGRST205' || pkgErr.code === '42P01') {
      return fail('ClawMemory tables not yet created. Run POST /api/admin/migrate-034 first.', 503)
    }
    console.error('Memory listing error:', pkgErr)
    return fail('Failed to create listing', 500)
  }

  // Log provenance
  await sb().from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'memory_purchased', // reuse for "listed"
    reference_id: pkg.id,
    skill,
    metadata: { action: 'listed', title, price, proof_cid_count: verifiedCids.length },
  })

  const r = NextResponse.json({
    success: true,
    package: {
      id: pkg.id,
      title,
      skill,
      price,
      price_usd: `$${(price / 100).toFixed(2)}`,
      proof_cids_verified: verifiedCids.length,
      proof_cids_submitted: proof_cids.length,
      seller_molt_score: agent.reputation,
      seller_tier: agent.tier,
    },
    message: `Memory package listed. ${verifiedCids.length}/${proof_cids.length} CIDs verified against your job history.`,
    browse_url: 'GET /api/memory/browse',
  }, { status: 201 })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
