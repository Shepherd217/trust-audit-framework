export const dynamic = 'force-dynamic';
/**
 * GET    /api/assets/[id] — Asset detail + seller TAP + reviews + purchase count
 * DELETE /api/assets/[id] — Unpublish (seller only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()

  const { data: asset, error } = await sb
    .from('agent_assets')
    .select(`
      *, seller:agent_registry!agent_assets_seller_id_fkey(agent_id, name, handle, reputation, tier, bio, completed_jobs, is_genesis, created_at)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (error || !asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))
  if (asset.status !== 'active') return applySecurityHeaders(NextResponse.json({ error: 'Asset is no longer available' }, { status: 410 }))

  // Get reviews
  const { data: reviews } = await sb
    .from('asset_reviews')
    .select('id, rating, review_text, created_at, reviewer:agent_registry!asset_reviews_reviewer_id_fkey(name, reputation, tier)')
    .eq('asset_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get purchase count (not buyer identities)
  const { count: purchaseCount } = await sb
    .from('asset_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('asset_id', params.id)

  // Check if current user has purchased (optional auth)
  const agentId = await resolveAgent(req)
  let hasPurchased = false
  let purchaseVersion: string | null = null
  if (agentId) {
    const { data: myPurchase } = await sb
      .from('asset_purchases')
      .select('id, purchased_version')
      .eq('asset_id', params.id)
      .eq('buyer_id', agentId)
      .maybeSingle()
    hasPurchased = !!myPurchase
    purchaseVersion = myPurchase?.purchased_version || null
  }

  const avgRating = reviews?.length
    ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null

  return applySecurityHeaders(NextResponse.json({
    ...asset,
    reviews: reviews || [],
    review_count: reviews?.length ?? 0,
    avg_rating: avgRating,
    purchase_count: purchaseCount ?? asset.downloads ?? 0,
    has_purchased: hasPurchased,
    purchase_version: purchaseVersion,
    price_usd: ((asset.price_credits ?? 0) / 100).toFixed(2),
    platform_fee_pct: 2.5,
    seller_earns_pct: 97.5,
  }))
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { data: asset } = await sb.from('agent_assets').select('seller_id, title').eq('id', params.id).maybeSingle()
  if (!asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))
  if (asset.seller_id !== agentId) return applySecurityHeaders(NextResponse.json({ error: 'Only the seller can unpublish this asset' }, { status: 403 }))

  await sb.from('agent_assets').update({ status: 'unpublished' }).eq('id', params.id)

  return applySecurityHeaders(NextResponse.json({
    success: true,
    message: `"${asset.title}" unpublished. Existing purchasers retain access to what they already bought.`,
  }))
}
