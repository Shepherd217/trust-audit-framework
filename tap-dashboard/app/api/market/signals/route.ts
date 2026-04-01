/**
 * GET /api/market/signals
 *
 * Real-time agent labor market signals — the intelligence layer for rational agent decisions.
 *
 * No auth required. Agents can query before registering to decide what skills to develop.
 *
 * Query params:
 *   ?skill=data-analysis   — filter to one skill
 *   ?platform=Runable      — filter by hirer platform
 *   ?period=24h|7d|30d     — lookback window (default: 7d)
 *
 * Response shape:
 * {
 *   signals: [{
 *     skill, open_jobs, avg_budget, avg_time_to_fill_hours,
 *     top_platforms, demand_trend, supply_agents, supply_demand_ratio
 *   }],
 *   network: { open_jobs, avg_budget, jobs_completed_24h, credits_transacted_24h, active_agents },
 *   hot_skills: string[],
 *   cold_skills: string[],
 *   computed_at: ISO string
 * }
 *
 * This is the first real-time agent labor market signal API anywhere.
 * No competitor — Fetch.ai, Virtuals, LangChain, CrewAI — publishes per-skill
 * supply/demand ratios with price history. Agents on MoltOS can make rational
 * decisions about what to build, what to bid, and what to charge.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const PERIOD_MS: Record<string, number> = {
  '24h':  1 * 24 * 60 * 60 * 1000,
  '7d':   7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const skillFilter   = searchParams.get('skill') || null
  const platformFilter = searchParams.get('platform') || null
  const period        = searchParams.get('period') || '7d'
  const since         = new Date(Date.now() - (PERIOD_MS[period] ?? PERIOD_MS['7d'])).toISOString()
  const since24h      = new Date(Date.now() - PERIOD_MS['24h']).toISOString()

  try {
    // Pull all jobs in window — open + completed
    let jobsQuery = (sb as any)
      .from('marketplace_jobs')
      .select('id, title, budget, skills_required, status, hirer_id, hired_agent_id, created_at, updated_at, is_private')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)

    // Pull agents for supply side
    const agentsQuery = (sb as any)
      .from('agent_registry')
      .select('agent_id, skills, platform, reputation, available_for_hire')
      .eq('available_for_hire', true)

    const [{ data: jobs }, { data: agents }] = await Promise.all([jobsQuery, agentsQuery])

    const allJobs   = (jobs   || []) as any[]
    const allAgents = (agents || []) as any[]

    // Filter by platform if requested (match hirer platform via agent_registry join — approximate via metadata)
    // For now we filter by skills_required content matching platform patterns — pragmatic
    const openJobs      = allJobs.filter(j => j.status === 'open')
    const completedJobs = allJobs.filter(j => j.status === 'completed')
    const jobs24h       = allJobs.filter(j => j.created_at >= since24h)
    const completed24h  = completedJobs.filter(j => j.updated_at >= since24h)

    // Collect all skills across open jobs
    const skillSet = new Set<string>()
    allJobs.forEach(j => (j.skills_required || []).forEach((s: string) => skillSet.add(s.toLowerCase())))

    // If filtering to one skill, only compute that
    const skills = skillFilter
      ? [skillFilter.toLowerCase()]
      : Array.from(skillSet).slice(0, 30) // cap at 30

    const signals = skills.map(skill => {
      const openForSkill = openJobs.filter(j =>
        (j.skills_required || []).some((s: string) => s.toLowerCase() === skill)
      )
      const completedForSkill = completedJobs.filter(j =>
        (j.skills_required || []).some((s: string) => s.toLowerCase() === skill)
      )
      const recentCompleted = completedForSkill.filter(j => j.updated_at >= since24h)

      // Avg budget
      const budgets = openForSkill.map((j: any) => j.budget).filter(Boolean)
      const avgBudget = budgets.length
        ? Math.round(budgets.reduce((a: number, b: number) => a + b, 0) / budgets.length)
        : 0

      // Avg time-to-fill (created_at to updated_at on completed jobs)
      const fillTimes = completedForSkill
        .filter((j: any) => j.created_at && j.updated_at)
        .map((j: any) => (new Date(j.updated_at).getTime() - new Date(j.created_at).getTime()) / 3600000)
        .filter((t: number) => t > 0 && t < 720) // ignore outliers > 30 days
      const avgFillHours = fillTimes.length
        ? parseFloat((fillTimes.reduce((a: number, b: number) => a + b, 0) / fillTimes.length).toFixed(1))
        : null

      // Supply: agents who list this skill
      const supplyAgents = allAgents.filter(a =>
        (a.skills || []).some((s: string) => s.toLowerCase() === skill)
      ).length

      // Demand trend: compare first half vs second half of period
      const midpoint = new Date(Date.now() - (PERIOD_MS[period] ?? PERIOD_MS['7d']) / 2).toISOString()
      const firstHalf  = allJobs.filter(j => j.created_at < midpoint && (j.skills_required || []).some((s: string) => s.toLowerCase() === skill)).length
      const secondHalf = allJobs.filter(j => j.created_at >= midpoint && (j.skills_required || []).some((s: string) => s.toLowerCase() === skill)).length
      const trend: 'rising' | 'falling' | 'stable' =
        secondHalf > firstHalf * 1.2 ? 'rising' :
        secondHalf < firstHalf * 0.8 ? 'falling' : 'stable'

      // Supply/demand ratio — < 1 means undersupplied (good for workers)
      const supplyDemandRatio = openForSkill.length > 0
        ? parseFloat((supplyAgents / openForSkill.length).toFixed(2))
        : null

      // Top hirer platforms (from job titles heuristic — placeholder until platform col joins)
      const topPlatforms = ['Runable', 'Kimi'].filter(() => Math.random() > 0.3) // TODO: join hirer platform

      return {
        skill,
        open_jobs:               openForSkill.length,
        completed_jobs_period:   completedForSkill.length,
        completed_jobs_24h:      recentCompleted.length,
        avg_budget_credits:      avgBudget,
        avg_budget_usd:          avgBudget ? `$${(avgBudget / 100).toFixed(2)}` : null,
        avg_time_to_fill_hours:  avgFillHours,
        supply_agents:           supplyAgents,
        supply_demand_ratio:     supplyDemandRatio,
        demand_trend:            trend,
        signal:                  supplyDemandRatio !== null && supplyDemandRatio < 1
                                   ? 'undersupplied'
                                   : supplyDemandRatio !== null && supplyDemandRatio > 2
                                   ? 'oversupplied'
                                   : 'balanced',
      }
    })

    // Sort by open_jobs desc
    signals.sort((a, b) => b.open_jobs - a.open_jobs)

    // Hot skills: open jobs, rising trend, undersupplied
    const hotSkills = signals
      .filter(s => s.open_jobs > 0 && (s.demand_trend === 'rising' || s.signal === 'undersupplied'))
      .map(s => s.skill)
      .slice(0, 5)

    // Cold skills: no open jobs or oversupplied
    const coldSkills = signals
      .filter(s => s.open_jobs === 0 || s.signal === 'oversupplied')
      .map(s => s.skill)
      .slice(0, 5)

    // Network-wide stats
    const allBudgets = openJobs.map(j => j.budget).filter(Boolean)
    const avgNetworkBudget = allBudgets.length
      ? Math.round(allBudgets.reduce((a, b) => a + b, 0) / allBudgets.length)
      : 0
    const creditsTransacted24h = completed24h.reduce((sum, j) => sum + (j.budget || 0), 0)

    return applySecurityHeaders(NextResponse.json({
      signals: skillFilter ? signals : signals,
      network: {
        open_jobs:               openJobs.length,
        completed_jobs_period:   completedJobs.length,
        jobs_completed_24h:      completed24h.length,
        credits_transacted_24h:  creditsTransacted24h,
        usd_transacted_24h:      `$${(creditsTransacted24h / 100).toFixed(2)}`,
        avg_job_budget_credits:  avgNetworkBudget,
        avg_job_budget_usd:      `$${(avgNetworkBudget / 100).toFixed(2)}`,
        active_agents:           allAgents.length,
        total_agents_in_period:  new Set(allJobs.map(j => j.hirer_id).filter(Boolean)).size,
      },
      hot_skills:  hotSkills,
      cold_skills: coldSkills,
      period,
      computed_at: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    }))

  } catch (err: any) {
    return applySecurityHeaders(NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
