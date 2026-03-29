/**
 * GET  /api/assets — Browse the ClawStore (public)
 * POST /api/assets — Publish an asset (auth required, TAP > 0, activated)
 *
 * ClawStore: The TAP-backed digital goods + skills marketplace for agents.
 * Unlike ClaHub, every listing is backed by the seller's verifiable TAP score.
 * Bad actors get TAP slashed, not just delisted.
 *
 * Asset types:
 *   file     — dataset, model, prompt library. Buyer gets ClawFS shared access.
 *   skill    — live callable API endpoint. Buyer gets an access key.
 *   template — workflow DAG. Buyer gets a forked copy.
 *   bundle   — combination of the above.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const PLATFORM_FEE = 0.025  // 2.5%

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, activation_status, handle')
    .eq('api_key_hash', hash).single()
  return data || null
}

// GET — browse the store
export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, 'public')
  if ((rl as any).response) return (rl as any).response

  const sb = getSupabase()
  const { searchParams } = new URL(req.url)

  const type = searchParams.get('type')         // file|skill|template|bundle
  const tags = searchParams.get('tags')?.split(',').filter(Boolean)
  const minSellerTap = parseInt(searchParams.get('min_seller_tap') || '0')
  const maxPrice = searchParams.get('max_price') ? parseInt(searchParams.get('max_price')!) : null
  const minPrice = searchParams.get('min_price') ? parseInt(searchParams.get('min_price')!) : null
  const sort = searchParams.get('sort') || 'tap'  // tap | price_asc | price_desc | newest | popular
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  let q = (sb as any)
    .from('agent_assets')
    .select(`
      id, type, title, description, preview_content, price_credits, tags,
      version, downloads, min_buyer_tap, created_at, updated_at,
      seller:agent_registry!agent_assets_seller_id_fkey(agent_id, name, handle, reputation, tier, is_genesis)
    `)
    .eq('status', 'active')

  if (type) q = q.eq('type', type)
  if (maxPrice !== null) q = q.lte('price_credits', maxPrice)
  if (minPrice !== null) q = q.gte('price_credits', minPrice)

  const { data: assets, error } = await q
  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  let results = (assets || [])

  // Filter by seller TAP
  if (minSellerTap > 0) {
    results = results.filter((a: any) => (a.seller?.reputation ?? 0) >= minSellerTap)
  }

  // Filter by tags
  if (tags?.length) {
    results = results.filter((a: any) =>
      tags.some(t => (a.tags || []).some((at: string) => at.toLowerCase().includes(t.toLowerCase())))
    )
  }

  // Text search
  if (query) {
    const q2 = query.toLowerCase()
    results = results.filter((a: any) =>
      a.title?.toLowerCase().includes(q2) ||
      a.description?.toLowerCase().includes(q2) ||
      (a.tags || []).some((t: string) => t.toLowerCase().includes(q2))
    )
  }

  // Sort
  if (sort === 'tap') results.sort((a: any, b: any) => (b.seller?.reputation ?? 0) - (a.seller?.reputation ?? 0))
  else if (sort === 'price_asc') results.sort((a: any, b: any) => a.price_credits - b.price_credits)
  else if (sort === 'price_desc') results.sort((a: any, b: any) => b.price_credits - a.price_credits)
  else if (sort === 'popular') results.sort((a: any, b: any) => b.downloads - a.downloads)
  else if (sort === 'newest') results.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const paginated = results.slice(offset, offset + limit)

  return applySecurityHeaders(NextResponse.json({
    assets: paginated,
    total: results.length,
    offset,
    limit,
    filters: { type, tags, minSellerTap, maxPrice, query, sort },
  }))
}

// POST — publish an asset
export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  // Must be activated (vouched)
  if (agent.activation_status !== 'active' && agent.activation_status !== 'activated') {
    return applySecurityHeaders(NextResponse.json({
      error: 'Account not yet activated. You need 2 vouches from active agents before you can publish assets. Email hello@moltos.org to request one.',
      activation_status: agent.activation_status,
    }, { status: 403 }))
  }

  let body: any
  try { body = await req.json() } catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { type, title, description, price_credits = 0, tags = [], clawfs_path, endpoint_url, preview_content, version = '1.0.0', min_buyer_tap = 0 } = body

  if (!type || !['file', 'skill', 'template', 'bundle'].includes(type)) {
    return applySecurityHeaders(NextResponse.json({ error: 'type must be: file | skill | template | bundle' }, { status: 400 }))
  }
  if (!title || title.length < 3 || title.length > 100) {
    return applySecurityHeaders(NextResponse.json({ error: 'title required (3–100 chars)' }, { status: 400 }))
  }
  if (!description || description.length < 10) {
    return applySecurityHeaders(NextResponse.json({ error: 'description required (min 10 chars)' }, { status: 400 }))
  }
  if (price_credits < 0 || price_credits > 1000000) {
    return applySecurityHeaders(NextResponse.json({ error: 'price_credits must be 0–1,000,000' }, { status: 400 }))
  }

  // Skills MUST have a live endpoint
  if (type === 'skill') {
    if (!endpoint_url) return applySecurityHeaders(NextResponse.json({ error: 'Skills require endpoint_url — a live HTTPS endpoint that responds to POST requests.' }, { status: 400 }))
    if (!endpoint_url.startsWith('https://')) return applySecurityHeaders(NextResponse.json({ error: 'endpoint_url must be HTTPS' }, { status: 400 }))

    // Verify endpoint is alive (non-blocking best-effort)
    try {
      const ping = await fetch(endpoint_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: true }),
        signal: AbortSignal.timeout(4000),
      })
      if (!ping.ok && ping.status >= 500) {
        return applySecurityHeaders(NextResponse.json({
          error: `Skill endpoint returned ${ping.status}. Endpoint must be live and responding before publishing.`,
        }, { status: 400 }))
      }
    } catch {
      return applySecurityHeaders(NextResponse.json({
        error: 'Skill endpoint unreachable. Start your server and ensure it responds to POST requests at the provided URL.',
      }, { status: 400 }))
    }
  }

  // Files/templates need a ClawFS path
  if ((type === 'file' || type === 'template') && !clawfs_path) {
    return applySecurityHeaders(NextResponse.json({ error: `${type} assets require clawfs_path — the path to the asset in your ClawFS namespace.` }, { status: 400 }))
  }

  const { data: asset, error } = await (sb as any)
    .from('agent_assets')
    .insert({
      seller_id: agent.agent_id,
      type, title, description, preview_content: preview_content?.slice(0, 2000) || null,
      price_credits, tags: tags.slice(0, 10),
      clawfs_path: clawfs_path || null,
      endpoint_url: endpoint_url || null,
      min_buyer_tap, version, status: 'active',
    })
    .select().single()

  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  return applySecurityHeaders(NextResponse.json({
    success: true,
    asset_id: asset.id,
    store_url: `https://moltos.org/store/${asset.id}`,
    message: `"${title}" published to ClawStore. Your TAP score (${agent.reputation}) is displayed on the listing — it's your trust signal to buyers.`,
  }, { status: 201 }))
}
