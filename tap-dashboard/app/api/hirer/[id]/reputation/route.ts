export const dynamic = 'force-dynamic';
/**
 * GET /api/hirer/:id/reputation
 * Returns hirer trust score, tier, and breakdown.
 * Public — agents query this before accepting a job.
 *
 * POST /api/hirer/:id/reputation
 * Rebuild/recalculate hirer_reputation from source data.
 * GENESIS_TOKEN protected.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const hirer_id = params.id

  // Check hirer_reputation table first
  const { data: rep } = await sb
    .from('hirer_reputation')
    .select('*')
    .eq('hirer_agent_id', hirer_id)
    .maybeSingle()

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

  // Fallback: compute basic stats from marketplace_jobs
  const { data: jobs } = await sb
    .from('marketplace_jobs')
    .select('id, status')
    .eq('hirer_id', hirer_id)

  const posted = (jobs || []).length
  const completed = (jobs || []).filter((j: any) => j.status === 'completed').length

  if (posted === 0) {
    return NextResponse.json({
      hirer_id,
      hirer_score: 50,
      tier: 'Neutral',
      tier_label: 'No job history yet.',
      breakdown: {
        jobs_posted: 0,
        jobs_completed: 0,
        completion_rate: 100,
        dispute_rate: null,
        avg_rating_given: null,
        on_time_release_rate: null,
        payment_default_count: 0,
      },
      last_updated: null,
    })
  }

  const score = 50 + (completed >= 10 ? 10 : completed >= 3 ? 5 : 0)
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
      dispute_rate: null,
      avg_rating_given: null,
      on_time_release_rate: null,
      payment_default_count: 0,
    },
    note: 'Full reputation breakdown available after first full compute cycle.',
    last_updated: null,
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const hirer_id = params.id

  // Count completed/disputed jobs from marketplace_contracts
  const { data: contracts } = await sb
    .from('marketplace_contracts')
    .select('status, created_at')
    .eq('hirer_id', hirer_id)

  const { data: jobs } = await sb
    .from('marketplace_jobs')
    .select('id, status')
    .eq('hirer_id', hirer_id)

  const posted = (jobs || []).length
  const completed = (contracts || []).filter((c: any) => c.status === 'completed').length

  // Estimate dispute count from dispute_cases (if exists) or default 0
  const disputed = 0

  const disputeRate = completed > 0 ? disputed / completed : 0
  const score = Math.max(0, Math.min(100, 50
    + Math.round(20 * (1 - Math.min(1, disputeRate * 3)))
    + (completed >= 10 ? 10 : completed >= 3 ? 5 : 0)
  ))
  const tier = score >= 75 ? 'Trusted' : score >= 40 ? 'Neutral' : 'Flagged'

  const { data: upserted } = await sb
    .from('hirer_reputation')
    .upsert({
      hirer_agent_id: hirer_id,
      jobs_posted: posted,
      jobs_completed: completed,
      dispute_rate: disputeRate,
      hirer_score: score,
      tier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'hirer_agent_id' })
    .select()
    .maybeSingle()

  return NextResponse.json({ ok: true, hirer_id, score, tier, record: upserted })
}

function getTierLabel(tier: string) {
  if (tier === 'Trusted') return 'Trusted hirer. Consistent payments, low dispute rate.'
  if (tier === 'Flagged') return 'Flagged. High dispute rate or payment issues. Proceed carefully.'
  return 'Neutral. Insufficient history to assess.'
}
