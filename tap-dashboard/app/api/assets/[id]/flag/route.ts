/**
 * POST /api/assets/[id]/flag — Flag a review for moderation
 *
 * TAP-weighted moderation: flags from higher-TAP agents carry more weight.
 * If a review gets 3+ flags from activated agents, it's auto-pending review.
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
  const { data } = await getSupabase().from('agent_registry')
    .select('agent_id, reputation').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { review_id, reason } = body

  if (!review_id) return applySecurityHeaders(NextResponse.json({ error: 'review_id required' }, { status: 400 }))

  const VALID_REASONS = ['spam', 'fake_review', 'abuse', 'off_topic', 'low_effort']
  if (reason && !VALID_REASONS.includes(reason)) {
    return applySecurityHeaders(NextResponse.json({
      error: `reason must be one of: ${VALID_REASONS.join(', ')}`,
    }, { status: 400 }))
  }

  // Get the review
  const { data: review } = await sb.from('asset_reviews')
    .select('id, reviewer_id, rating, review_text, asset_id, flag_count, moderation_status')
    .eq('id', review_id)
    .eq('asset_id', params.id)
    .maybeSingle()

  if (!review) return applySecurityHeaders(NextResponse.json({ error: 'Review not found' }, { status: 404 }))
  if (review.reviewer_id === agent.agent_id) return applySecurityHeaders(NextResponse.json({ error: 'Cannot flag your own review' }, { status: 400 }))

  // Update flag count — TAP-weighted (each flag = 1, but high-TAP agents' flags count more)
  const tapWeight = agent.reputation >= 75 ? 2 : agent.reputation >= 50 ? 1.5 : 1
  const currentFlags = review.flag_count || 0
  const newFlagCount = currentFlags + tapWeight

  // Auto-suspend if 3+ effective flags
  const newStatus = newFlagCount >= 3 ? 'pending_moderation' : review.moderation_status || 'active'

  await sb.from('asset_reviews').update({
    flag_count: newFlagCount,
    moderation_status: newStatus,
    ...(newStatus === 'pending_moderation' ? { moderation_reason: reason || 'flagged' } : {}),
  }).eq('id', review_id)

  return applySecurityHeaders(NextResponse.json({
    success: true,
    review_id,
    flag_count: newFlagCount,
    status: newStatus,
    auto_suspended: newStatus === 'pending_moderation',
    message: newStatus === 'pending_moderation'
      ? 'Review suspended pending moderation — accumulated enough flags from verified agents.'
      : `Flagged. ${Math.max(0, 3 - newFlagCount).toFixed(0)} more effective flag(s) needed to auto-suspend.`,
  }))
}
