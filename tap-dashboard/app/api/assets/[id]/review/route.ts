export const dynamic = 'force-dynamic';
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
import { flagViolation } from '@/lib/security-violations'
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
  const { data } = await getSupabase().from('agent_registry')
    .select('agent_id, name, reputation').eq('api_key_hash', hash).maybeSingle()
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
  const { data: purchase } = await sb.from('asset_purchases')
    .select('id').eq('asset_id', params.id).eq('buyer_id', reviewer.agent_id).maybeSingle()
  if (!purchase) {
    return applySecurityHeaders(NextResponse.json({
      error: 'You must purchase this asset before reviewing it. This prevents fake reviews.',
    }, { status: 403 }))
  }

  // Get asset + seller
  const { data: asset } = await sb.from('agent_assets')
    .select('id, title, seller_id').eq('id', params.id).maybeSingle()
  if (!asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))
  // Block seller reviewing their own asset
  if (asset.seller_id === reviewer.agent_id) {
    await flagViolation(reviewer.agent_id, 'self_review', { asset_id: params.id }, '/assets/review')
    return applySecurityHeaders(NextResponse.json({ error: 'Cannot review your own asset' }, { status: 400 }))
  }

  // Auto-moderation: flag low-effort reviews (<10 words) as pending
  const wordCount = (review_text || '').trim().split(/\s+/).filter(Boolean).length
  const isLowEffort = review_text && wordCount < 10
  const moderationStatus = isLowEffort ? 'pending_moderation' : 'active'

  // Insert or update review (one per buyer per asset)
  const { data: review, error } = await sb.from('asset_reviews').upsert({
    asset_id: params.id, reviewer_id: reviewer.agent_id,
    purchase_id: purchase.id, rating,
    review_text: review_text?.slice(0, 1000) || null,
    moderation_status: moderationStatus,
    moderation_reason: isLowEffort ? 'auto_low_effort' : null,
  }, { onConflict: 'asset_id,reviewer_id' }).select().maybeSingle()

  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  // TAP effect — anti-farming protections:
  // 1. Reviewer must have TAP >= 10 for their review to affect seller TAP
  //    (sock puppets with 0 TAP cannot farm TAP for sellers)
  // 2. The purchased asset must cost >= 500 credits
  //    (buying a 1-credit asset to leave 5★ and +1 TAP costs too little)
  // 3. Review must not be flagged as low effort (auto-moderated)
  const { data: purchaseDetails } = await sb.from('asset_purchases')
    .select('amount_paid').eq('id', purchase.id).maybeSingle()
  const purchasedAtPrice = purchaseDetails?.amount_paid ?? 0

  const reviewerHasEnoughTap = (reviewer.reputation || 0) >= 10
  const purchasePriceQualifies = purchasedAtPrice >= 500
  const reviewQualifies = reviewerHasEnoughTap && purchasePriceQualifies && !isLowEffort

  if (reviewQualifies) {
    const { data: seller } = await sb.from('agent_registry').select('reputation').eq('agent_id', asset.seller_id).maybeSingle()
    if (seller) {
      if (rating >= 5) {
        await sb.from('agent_registry').update({ reputation: Math.min(100, (seller.reputation || 0) + 1) }).eq('agent_id', asset.seller_id)
      } else if (rating <= 2) {
        await sb.from('agent_registry').update({ reputation: Math.max(0, (seller.reputation || 0) - 1) }).eq('agent_id', asset.seller_id)
      }
    }
  }

  // Notify seller of review
  await sb.from('notifications').insert({
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
    message: 'Review submitted. Thank you — this keeps Store quality high.',
  }))
}
