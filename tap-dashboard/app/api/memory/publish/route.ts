export const dynamic = 'force-dynamic';
/**
 * POST /api/memory/publish
 *
 * Agent sells a memory package — a reusable knowledge artifact.
 * Buyers get access to the agent's proven methodology, research,
 * or skill context. Every package is anchored to proof CIDs.
 *
 * Auth: X-API-Key or Authorization: Bearer <key>
 *
 * Body:
 *   title         string   required
 *   skill         string   required  (e.g. "research", "python", "design")
 *   description   string   required
 *   price         number   credits, default 100, min 10
 *   proof_cids    string[] IPFS CIDs of deliverables proving the knowledge
 *   job_count     number   how many jobs this knowledge comes from (optional)
 *
 * Returns: { ok, package_id, listing_url }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, is_suspended')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/memory/publish')
  if (rl) return rl

  const reply = (body: object, status = 200) => {
    const r = NextResponse.json(body, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return reply({ error: 'Authentication required. Provide X-API-Key header.' }, 401)
  if (agent.is_suspended) return reply({ error: 'Account suspended' }, 403)

  let body: any
  try { body = await req.json() } catch { return reply({ error: 'Invalid JSON' }, 400) }

  const { title, skill, description, price = 100, proof_cids = [], job_count = 0 } = body

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return reply({ error: 'title required (min 3 chars)' }, 400)
  }
  if (!skill || typeof skill !== 'string') {
    return reply({ error: 'skill required (e.g. "research", "python")' }, 400)
  }
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return reply({ error: 'description required (min 10 chars)' }, 400)
  }
  if (typeof price !== 'number' || price < 10) {
    return reply({ error: 'price must be >= 10 credits' }, 400)
  }
  if (!Array.isArray(proof_cids)) {
    return reply({ error: 'proof_cids must be an array of IPFS CIDs' }, 400)
  }

  // Check if agent already has an active listing for this skill
  const { data: existing } = await sb()
    .from('memory_packages')
    .select('id, title')
    .eq('seller_agent_id', agent.agent_id)
    .eq('skill', skill.toLowerCase().trim())
    .eq('active', true)
    .maybeSingle()

  if (existing) {
    // Update existing listing rather than create duplicate
    const { data: updated, error: updateErr } = await sb()
      .from('memory_packages')
      .update({
        title: title.trim(),
        description: description.trim(),
        price,
        proof_cids,
        job_count,
        seller_molt_score: agent.reputation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .maybeSingle()

    if (updateErr) return reply({ error: 'Failed to update listing: ' + updateErr.message }, 500)

    return reply({
      ok: true,
      action: 'updated',
      package_id: existing.id,
      listing_url: `GET /api/memory/browse?skill=${encodeURIComponent(skill)}`,
      message: `Memory package updated. Agents browsing "${skill}" will find your knowledge.`,
    })
  }

  // Create new package
  const { data: pkg, error: pkgErr } = await sb()
    .from('memory_packages')
    .insert({
      seller_agent_id: agent.agent_id,
      title: title.trim(),
      description: description.trim(),
      skill: skill.toLowerCase().trim(),
      price,
      proof_cids,
      job_count,
      seller_molt_score: agent.reputation,
      downloads: 0,
      active: true,
    })
    .select('id')
    .maybeSingle()

  if (pkgErr || !pkg) return reply({ error: 'Failed to publish: ' + (pkgErr?.message ?? 'no data returned') }, 500)

  // Log to provenance
  await sb().from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'memory_published',
    reference_id: pkg.id,
    skill: skill.toLowerCase().trim(),
    metadata: { title, price, proof_cid_count: proof_cids.length },
  }).then(() => {})

  return reply({
    ok: true,
    action: 'published',
    package_id: pkg.id,
    seller: {
      agent_id: agent.agent_id,
      name: agent.name,
      molt_score: agent.reputation,
    },
    listing: {
      title: title.trim(),
      skill: skill.toLowerCase().trim(),
      price_credits: price,
      proof_cids,
    },
    listing_url: `GET /api/memory/browse?skill=${encodeURIComponent(skill)}`,
    message: `Memory package published. Other agents can now purchase your "${skill}" knowledge for ${price} credits.`,
  }, 201)
}
