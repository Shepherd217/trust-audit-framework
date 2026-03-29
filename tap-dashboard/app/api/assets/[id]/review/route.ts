/**
 * POST /api/assets/[id]/review
 *
 * Leave a review for a purchased asset.
 * - Must be a verified purchaser (purchase record required)
 * - 1–5 star rating + optional text
 * - Reviews feed into the seller's TAP via attestation-like mechanism
 * - Bad reviews (1–2 stars) from verified buyers nudge seller TAP down
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry')
    .select('agent_id, name, reputation').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const reviewer = await resolveAgent(req)
  if (!reviewer) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { rating, review_text } = body

  if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return applySecurityHeaders(NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 }))
  }

  // Must be a verified purchaser
  const { data: purchase } = await (sb as any).from('asset_purchases')
    .select('id').eq('asset_id', params.id).eq('buyer_id', reviewer.agent_id).maybeSingle()
  if (!purchase) {
    return applySecurityHeaders(NextResponse.json({
      error: 'You must purchase this asset before reviewing it. This prevents fake reviews.',
    }, { status: 403 }))
  }

  // Get asset + seller
  const { data: asset } = await (sb as any).from('agent_assets')
    .select('id, title, seller_id').eq('id', params.id).single()
  if (!asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))

  // Insert or update review (one per buyer per asset)
  const { data: review, error } = await (sb as any).from('asset_reviews').upsert({
    asset_id: params.id, reviewer_id: reviewer.agent_id,
    purchase_id: purchase.id, rating,
    review_text: review_text?.slice(0, 1000) || null,
  }, { onConflict: 'asset_id,reviewer_id' }).select().single()

  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  // TAP effect: low ratings from verified buyers affect seller reputation
  // 5 stars = +1 TAP (attested quality), 1-2 stars = -1 TAP (verified bad experience)
  if (rating >= 5) {
    await (sb as any).from('agent_registry')
      .update({ reputation: (sb as any).raw ? undefined : undefined })
      .eq('agent_id', asset.seller_id)
    // Simple increment
    const { data: seller } = await (sb as any).from('agent_registry').select('reputation').eq('agent_id', asset.seller_id).single()
    if (seller) {
      await (sb as any).from('agent_registry').update({ reputation: Math.min(100, (seller.reputation || 0) + 1) }).eq('agent_id', asset.seller_id)
    }
  } else if (rating <= 2) {
    const { data: seller } = await (sb as any).from('agent_registry').select('reputation').eq('agent_id', asset.seller_id).single()
    if (seller) {
      await (sb as any).from('agent_registry').update({ reputation: Math.max(0, (seller.reputation || 0) - 1) }).eq('agent_id', asset.seller_id)
    }
  }

  // Notify seller of review
  await (sb as any).from('notifications').insert({
    agent_id: asset.seller_id, notification_type: 'asset.review',
    title: `${reviewer.name} left a ${rating}★ review on "${asset.title}"`,
    message: review_text || `${rating}/5 stars.`,
    metadata: { asset_id: params.id, rating, reviewer_tap: reviewer.reputation }, read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    review_id: review.id,
    rating,
    tap_effect: rating >= 5 ? '+1 TAP to seller' : rating <= 2 ? '-1 TAP from seller' : 'no TAP change',
    message: 'Review submitted. Thank you — this keeps ClawStore quality high.',
  }))
}
