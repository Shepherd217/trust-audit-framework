/**
 * GET /api/market/history
 *
 * Price and volume history for a skill or the whole network.
 * Bucketed by day. Used to render trend charts on /market.
 *
 * Query params:
 *   ?skill=data-analysis   — skill to get history for (required)
 *   ?period=7d|30d         — lookback (default 30d)
 *
 * Response:
 * {
 *   skill,
 *   buckets: [{ date, open_jobs, completed_jobs, avg_budget, credits_volume }],
 *   period
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const skill  = searchParams.get('skill')
  const period = searchParams.get('period') || '30d'
  const days   = period === '7d' ? 7 : 30
  const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  if (!skill) {
    return applySecurityHeaders(NextResponse.json({ error: '?skill= required' }, { status: 400 }))
  }

  try {
    const { data: jobs } = await sb
      .from('marketplace_jobs')
      .select('budget, skills_required, status, created_at, updated_at')
      .gte('created_at', since)
      .limit(1000)

    const allJobs = (jobs || []) as any[]
    const skillJobs = allJobs.filter(j =>
      (j.skills_required || []).some((s: string) => s.toLowerCase() === skill.toLowerCase())
    )

    // Build daily buckets
    const buckets: Record<string, { date: string; open_jobs: number; completed_jobs: number; budgets: number[]; credits_volume: number }> = {}

    for (let d = 0; d < days; d++) {
      const dt = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
      const key = dt.toISOString().slice(0, 10)
      buckets[key] = { date: key, open_jobs: 0, completed_jobs: 0, budgets: [], credits_volume: 0 }
    }

    skillJobs.forEach(j => {
      const dateKey = j.created_at?.slice(0, 10)
      if (!dateKey || !buckets[dateKey]) return
      if (j.status === 'open') {
        buckets[dateKey].open_jobs++
        if (j.budget) buckets[dateKey].budgets.push(j.budget)
      } else if (j.status === 'completed') {
        buckets[dateKey].completed_jobs++
        if (j.budget) buckets[dateKey].credits_volume += j.budget
        if (j.budget) buckets[dateKey].budgets.push(j.budget)
      }
    })

    const result = Object.values(buckets)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(b => ({
        date:            b.date,
        open_jobs:       b.open_jobs,
        completed_jobs:  b.completed_jobs,
        avg_budget:      b.budgets.length ? Math.round(b.budgets.reduce((a, x) => a + x, 0) / b.budgets.length) : 0,
        credits_volume:  b.credits_volume,
      }))

    return applySecurityHeaders(NextResponse.json({
      skill,
      period,
      buckets: result,
      total_jobs:     skillJobs.length,
      total_volume:   skillJobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.budget || 0), 0),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    }))

  } catch (err: any) {
    return applySecurityHeaders(NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
