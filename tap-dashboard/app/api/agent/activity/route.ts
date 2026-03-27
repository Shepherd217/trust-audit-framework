/**
 * GET /api/agent/activity?agent_id=<id>&limit=20
 *
 * Public activity feed for any agent.
 * Shows completed jobs, ratings, attestations, disputes — verifiable history.
 * Used on storefronts to show hirers what an agent has done.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  if (!agentId) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))

  // Get completed jobs as worker
  const { data: jobs } = await (supabase as any)
    .from('marketplace_contracts')
    .select('id, job_id, agreed_budget, status, rating, review, completed_at, created_at')
    .eq('worker_id', agentId)
    .in('status', ['completed', 'active', 'disputed'])
    .order('created_at', { ascending: false })
    .limit(limit)

  // Enrich with job titles
  const jobIds = (jobs || []).map((j: any) => j.job_id).filter(Boolean)
  let jobTitles: Record<string, string> = {}
  if (jobIds.length > 0) {
    const { data: jobData } = await (supabase as any)
      .from('marketplace_jobs')
      .select('id, title, category')
      .in('id', jobIds)
    if (jobData) jobData.forEach((j: any) => { jobTitles[j.id] = j.title })
  }

  // Get attestations received
  const { data: attestations } = await (supabase as any)
    .from('attestations')
    .select('attester_id, score, claim, created_at')
    .eq('target_agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10)

  // Compute stats
  const completed = (jobs || []).filter((j: any) => j.status === 'completed')
  const ratings = completed.filter((j: any) => j.rating).map((j: any) => j.rating)
  const avgRating = ratings.length > 0 ? (ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length).toFixed(1) : null
  const totalEarned = completed.reduce((s: number, j: any) => s + Math.floor((j.agreed_budget || 0) * 0.975), 0)

  return applySecurityHeaders(NextResponse.json({
    agent_id: agentId,
    stats: {
      jobs_completed: completed.length,
      avg_rating: avgRating ? parseFloat(avgRating) : null,
      total_earned_usd: (totalEarned / 100).toFixed(2),
      attestations_received: (attestations || []).length,
      completion_rate: jobs?.length ? Math.round((completed.length / jobs.length) * 100) : null,
    },
    jobs: (jobs || []).map((j: any) => ({
      contract_id: j.id,
      job_id: j.job_id,
      title: jobTitles[j.job_id] || 'Untitled',
      budget_usd: ((j.agreed_budget || 0) / 100).toFixed(2),
      status: j.status,
      rating: j.rating,
      review: j.review,
      completed_at: j.completed_at,
    })),
    attestations: attestations || [],
  }, { headers: { 'Cache-Control': 'public, s-maxage=60' } }))
}
