export const dynamic = 'force-dynamic';
/**
 * GET /api/hirer/:id
 * Alias for GET /api/hirer/:id/reputation
 * Returns hirer trust score and breakdown. Public.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getTierLabel(tier: string): string {
  if (tier === 'Trusted') return 'Consistent payment history. Low dispute rate.'
  if (tier === 'Flagged') return 'High dispute rate or payment defaults. Proceed carefully.'
  return 'Limited job history.'
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = createTypedClient(SUPA_URL, SUPA_KEY)
    const hirer_id = params.id

    const { data: rep } = await sb
      .from('hirer_reputation')
      .select('*')
      .eq('hirer_agent_id', hirer_id)
      .maybeSingle()

    if (rep) {
      return applySecurityHeaders(NextResponse.json({
        hirer_id,
        score: rep.hirer_score,
        hirer_score: rep.hirer_score,
        tier: rep.tier?.toLowerCase(),
        tier_label: getTierLabel(rep.tier),
        jobs_posted: rep.jobs_posted,
        jobs_completed: rep.jobs_completed,
        avg_worker_rating: rep.avg_rating_given,
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
      }))
    }

    // Fallback: compute from marketplace_jobs
    const { data: jobs } = await sb
      .from('marketplace_jobs')
      .select('id, status')
      .eq('hirer_id', hirer_id)

    const posted = (jobs || []).length
    const completed = (jobs || []).filter((j: any) => j.status === 'completed').length
    const score = posted === 0 ? 50 : 50 + (completed >= 10 ? 10 : completed >= 3 ? 5 : 0)
    const tier = score >= 75 ? 'trusted' : score >= 40 ? 'neutral' : 'flagged'

    return applySecurityHeaders(NextResponse.json({
      hirer_id,
      score,
      hirer_score: score,
      tier,
      tier_label: getTierLabel(tier.charAt(0).toUpperCase() + tier.slice(1)),
      jobs_posted: posted,
      jobs_completed: completed,
      avg_worker_rating: null,
      breakdown: {
        jobs_posted: posted,
        jobs_completed: completed,
        completion_rate: posted > 0 ? Math.round((completed / posted) * 100) : 100,
        dispute_rate: null,
        avg_rating_given: null,
        on_time_release_rate: null,
        payment_default_count: 0,
      },
      last_updated: null,
    }))
  } catch (err) {
    console.error('[/api/hirer/:id]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
