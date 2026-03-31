/**
 * GET /api/hirer/:id/reputation
 * Returns hirer trust score, tier, and breakdown.
 * Public — agents can query this before accepting a job.
 *
 * POST /api/hirer/:id/reputation
 * Rebuild/recalculate hirer_reputation from source data.
 * GENESIS_TOKEN protected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient(SUPA_URL, SUPA_KEY)
  const hirer_id = params.id

  // Try hirer_reputation table first
  const { data: rep } = await sb
    .from('hirer_reputation')
    .select('*')
    .eq('hirer_agent_id', hirer_id)
    .single()

  if (rep) {
    return NextResponse.json({
      hirer_id,
      hirer_score: rep.hirer_score,
      tier: rep.tier,
      tier_label: getTierLabel(rep.tier),
      breakdown: {
        jobs_posted: rep.jobs_posted,
        jobs_completed: rep.jobs_completed,
        completion_rate: rep.jobs_posted > 0 ? Math.round((rep.jobs_completed / rep.jobs_posted) * 100) : 100,
        dispute_rate: rep.dispute_rate,
        avg_rating_given: rep.avg_rating_given,
        on_time_release_rate: rep.on_time_release_rate,
        payment_default_count: rep.payment_default_count,
      },
      last_updated: rep.updated_at,
    })
  }

  // No record — compute from scratch from jobs table
  const { data: jobs } = await sb
    .from('jobs')
    .select('id, status, hirer_rating, escrow_released_at, deadline, dispute_id')
    .eq('hirer_id', hirer_id)

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      hirer_id,
      hirer_score: 50,
      tier: 'Neutral',
      tier_label: 'No job history yet.',
      breakdown: {
        jobs_posted: 0,
        jobs_completed: 0,
        completion_rate: 100,
        dispute_rate: 0,
        avg_rating_given: null,
        on_time_release_rate: null,
        payment_default_count: 0,
      },
      last_updated: null,
    })
  }

  const posted = jobs.length
  const completed = jobs.filter(j => j.status === 'completed').length
  const disputed = jobs.filter(j => j.dispute_id).length
  const disputeRate = completed > 0 ? disputed / completed : 0
  const ratings = jobs.filter(j => j.hirer_rating != null).map(j => j.hirer_rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0
  const onTimeReleases = jobs.filter(j => j.status === 'completed' && j.escrow_released_at && j.deadline
    && new Date(j.escrow_released_at) <= new Date(j.deadline)).length
  const onTimeRate = completed > 0 ? onTimeReleases / completed : 1.0

  const score = computeHirerScore({ disputeRate, avgRating, onTimeRate, completed, posted })
  const tier = score >= 75 ? 'Trusted' : score >= 40 ? 'Neutral' : 'Flagged'

  return NextResponse.json({
    hirer_id,
    hirer_score: score,
    tier,
    tier_label: getTierLabel(tier),
    breakdown: {
      jobs_posted: posted,
      jobs_completed: completed,
      completion_rate: posted > 0 ? Math.round((completed / posted) * 100) : 100,
      dispute_rate: Math.round(disputeRate * 100) / 100,
      avg_rating_given: Math.round(avgRating * 10) / 10,
      on_time_release_rate: Math.round(onTimeRate * 100) / 100,
      payment_default_count: 0,
    },
    last_updated: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)
  const hirer_id = params.id

  const { data: jobs } = await sb
    .from('jobs')
    .select('id, status, hirer_rating, escrow_released_at, deadline, dispute_id')
    .eq('hirer_id', hirer_id)

  const posted = (jobs || []).length
  const completed = (jobs || []).filter(j => j.status === 'completed').length
  const disputed = (jobs || []).filter(j => j.dispute_id).length
  const disputeRate = completed > 0 ? disputed / completed : 0
  const ratings = (jobs || []).filter(j => j.hirer_rating != null).map(j => j.hirer_rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0
  const onTimeReleases = (jobs || []).filter(j => j.status === 'completed' && j.escrow_released_at && j.deadline
    && new Date(j.escrow_released_at) <= new Date(j.deadline)).length
  const onTimeRate = completed > 0 ? onTimeReleases / completed : 1.0

  const score = computeHirerScore({ disputeRate, avgRating, onTimeRate, completed, posted })
  const tier = score >= 75 ? 'Trusted' : score >= 40 ? 'Neutral' : 'Flagged'

  const { data: upserted } = await sb
    .from('hirer_reputation')
    .upsert({
      hirer_agent_id: hirer_id,
      jobs_posted: posted,
      jobs_completed: completed,
      dispute_rate: disputeRate,
      avg_rating_given: avgRating,
      on_time_release_rate: onTimeRate,
      hirer_score: score,
      tier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'hirer_agent_id' })
    .select()
    .single()

  return NextResponse.json({ ok: true, hirer_id, score, tier, record: upserted })
}

function computeHirerScore({ disputeRate, avgRating, onTimeRate, completed, posted }: {
  disputeRate: number; avgRating: number; onTimeRate: number; completed: number; posted: number
}) {
  // Base 50 for new hirers
  let score = 50
  // +20 for low dispute rate (penalize high)
  score += Math.round(20 * (1 - Math.min(1, disputeRate * 3)))
  // +15 for avg rating given (penalize hirers who give low ratings unfairly)
  score += Math.round(15 * (avgRating / 5))
  // +15 for on-time escrow release
  score += Math.round(15 * onTimeRate)
  // Volume bonus: +10 if completed 10+ jobs
  if (completed >= 10) score += 10
  else if (completed >= 3) score += 5
  return Math.max(0, Math.min(100, score))
}

function getTierLabel(tier: string) {
  if (tier === 'Trusted') return 'Trusted hirer. Consistent payments, low dispute rate, fair ratings.'
  if (tier === 'Flagged') return 'Flagged. High dispute rate or payment issues. Proceed carefully.'
  return 'Neutral. Insufficient history to assess.'
}
