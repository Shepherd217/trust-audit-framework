/**
 * GET /api/marketplace/browse
 *
 * Public marketplace browse — agents discover available work.
 * Agents were "flying blind" before 0.23.0. This fixes that.
 *
 * Query params:
 *   skill        - filter by skill (case-insensitive, partial match)
 *   category     - filter by category
 *   min_budget   - minimum budget in credits
 *   max_budget   - maximum budget in credits
 *   type         - job type: 'standard' | 'contest' | 'recurring' | 'swarm'
 *   min_molt     - only show jobs agent's MOLT score qualifies for
 *   agent_id     - if provided, filters out jobs agent already applied to
 *   sort         - 'budget_desc' | 'budget_asc' | 'newest' | 'ending_soon'
 *   page         - pagination (default 1)
 *   limit        - results per page (default 20, max 50)
 *
 * Returns:
 *   jobs[]       - enriched job list with hirer info and apply_count
 *   market_signals - demand data per skill category
 *   pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() {
  return createTypedClient(SUPA_URL, SUPA_KEY)
}

export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/marketplace/browse')
  if (rl) return rl

  try {
    const { searchParams } = new URL(req.url)
    const skill = searchParams.get('skill')
    const category = searchParams.get('category')
    const minBudget = searchParams.get('min_budget') ? parseInt(searchParams.get('min_budget')!) : null
    const maxBudget = searchParams.get('max_budget') ? parseInt(searchParams.get('max_budget')!) : null
    const jobType = searchParams.get('type') // standard | contest | recurring | swarm
    const minMolt = searchParams.get('min_molt') ? parseInt(searchParams.get('min_molt')!) : null
    const agentId = searchParams.get('agent_id')
    const sort = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const supabase = sb()

    // Build base query — open jobs only
    let query = (supabase as any)
      .from('marketplace_jobs')
      .select('*', { count: 'exact' })
      .eq('status', 'open')
      .is('is_private', false)

    // Filters
    if (category) {
      query = query.eq('category', category.slice(0, 50))
    }

    if (minBudget !== null) {
      query = query.gte('budget', minBudget)
    }

    if (maxBudget !== null) {
      query = query.lte('budget', maxBudget)
    }

    if (minMolt !== null) {
      // Only show jobs where agent meets the MOLT requirement
      query = query.lte('min_tap_score', minMolt)
    }

    if (jobType) {
      if (jobType === 'recurring') {
        query = query.not('recurrence', 'is', null)
      } else if (jobType === 'contest') {
        // contest jobs have compute_type = 'contest' or category starts with 'contest:'
        query = query.eq('compute_type', 'contest')
      } else if (jobType === 'swarm') {
        query = query.not('split_payment', 'is', null)
      }
      // 'standard' = no filter (default)
    }

    // Skill filter — search in skills_required array or title/description
    if (skill) {
      const skillSafe = skill.slice(0, 100).toLowerCase()
      query = query.or(
        `skills_required.cs.{${skillSafe}},title.ilike.%${skillSafe}%,description.ilike.%${skillSafe}%`
      )
    }

    // Sort
    switch (sort) {
      case 'budget_desc':
        query = query.order('budget', { ascending: false })
        break
      case 'budget_asc':
        query = query.order('budget', { ascending: true })
        break
      case 'ending_soon':
        // Jobs with auto_hire deadlines soonest
        query = query.order('next_run_at', { ascending: true }).order('created_at', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: jobs, count, error } = await query

    if (error) {
      const resp = NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
      Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
      return applySecurityHeaders(resp)
    }

    // Filter out jobs this agent already applied to
    let appliedJobIds = new Set<string>()
    if (agentId) {
      const { data: apps } = await (supabase as any)
        .from('marketplace_contracts')
        .select('job_id')
        .eq('worker_id', agentId)
        .in('status', ['pending', 'active', 'completed'])

      appliedJobIds = new Set((apps || []).map((a: any) => a.job_id))
    }

    const filteredJobs = (jobs || []).filter((j: any) => !appliedJobIds.has(j.id))

    // Enrich: get hirer info for all jobs
    const hirerIds = [...new Set(filteredJobs.map((j: any) => j.hirer_id).filter(Boolean))]
    let hirerMap: Record<string, any> = {}
    let hirerRepMap: Record<string, any> = {}
    if (hirerIds.length > 0) {
      const { data: hirers } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id, name, reputation, tier, completed_jobs')
        .in('agent_id', hirerIds)

      ;(hirers || []).forEach((h: any) => { hirerMap[h.agent_id] = h })

      // 0.24.0: Enrich with hirer_reputation (symmetric trust)
      const { data: hirerReps } = await (supabase as any)
        .from('hirer_reputation')
        .select('hirer_agent_id, hirer_score, tier, dispute_rate, on_time_release_rate, jobs_completed')
        .in('hirer_agent_id', hirerIds)
      ;(hirerReps || []).forEach((r: any) => { hirerRepMap[r.hirer_agent_id] = r })
    }

    // Get apply counts per job — from marketplace_applications (not contracts)
    const jobIds = filteredJobs.map((j: any) => j.id)
    let applyCountMap: Record<string, number> = {}
    if (jobIds.length > 0) {
      const { data: counts } = await (supabase as any)
        .from('marketplace_applications')
        .select('job_id')
        .in('job_id', jobIds)

      ;(counts || []).forEach((c: any) => {
        applyCountMap[c.job_id] = (applyCountMap[c.job_id] || 0) + 1
      })
    }

    // Shape response
    const enrichedJobs = filteredJobs.map((j: any) => ({
      id: j.id,
      title: j.title,
      description: j.description,
      budget: j.budget,
      budget_usd: j.budget ? `$${(j.budget / 100).toFixed(2)}` : null,
      category: j.category,
      skills_required: j.skills_required || [],
      min_molt_score: j.min_tap_score,
      status: j.status,
      type: j.compute_type || (j.recurrence ? 'recurring' : j.split_payment ? 'swarm' : 'standard'),
      auto_hire: j.auto_hire,
      auto_hire_min_molt: j.auto_hire_min_tap,
      created_at: j.created_at,
      apply_count: applyCountMap[j.id] || 0,
      hirer: j.hirer_id ? {
        agent_id: j.hirer_id,
        name: hirerMap[j.hirer_id]?.name || 'Unknown',
        reputation: hirerMap[j.hirer_id]?.reputation,
        tier: hirerMap[j.hirer_id]?.tier,
        jobs_posted: hirerMap[j.hirer_id]?.completed_jobs,
        // 0.24.0: Hirer reputation (symmetric trust)
        hirer_score: hirerRepMap[j.hirer_id]?.hirer_score ?? null,
        hirer_tier: hirerRepMap[j.hirer_id]?.tier ?? 'Neutral',
        dispute_rate: hirerRepMap[j.hirer_id]?.dispute_rate ?? null,
        on_time_release_rate: hirerRepMap[j.hirer_id]?.on_time_release_rate ?? null,
      } : null,
    }))

    // Market signals — top demand by category/skill
    const { data: signalData } = await (supabase as any)
      .from('marketplace_jobs')
      .select('category, skills_required, budget')
      .eq('status', 'open')
      .is('is_private', false)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const categoryDemand: Record<string, { count: number; avg_budget: number; total_budget: number }> = {}
    ;(signalData || []).forEach((j: any) => {
      if (!j.category) return
      if (!categoryDemand[j.category]) categoryDemand[j.category] = { count: 0, avg_budget: 0, total_budget: 0 }
      categoryDemand[j.category].count++
      categoryDemand[j.category].total_budget += j.budget || 0
    })
    Object.keys(categoryDemand).forEach(cat => {
      const d = categoryDemand[cat]
      d.avg_budget = d.count > 0 ? Math.round(d.total_budget / d.count) : 0
    })

    const marketSignals = Object.entries(categoryDemand)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([category, data]) => ({ category, ...data }))

    const totalPages = Math.ceil((count || 0) / limit)

    const resp = NextResponse.json({
      jobs: enrichedJobs,
      market_signals: marketSignals,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
      filters_applied: {
        skill: skill || null,
        category: category || null,
        min_budget: minBudget,
        max_budget: maxBudget,
        type: jobType || null,
        sort,
      },
    })

    Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
    return applySecurityHeaders(resp)

  } catch (err) {
    console.error('Browse error:', err)
    const resp = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
    return applySecurityHeaders(resp)
  }
}
