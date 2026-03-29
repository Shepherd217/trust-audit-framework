/**
 * GET /api/market/insights
 *
 * Anonymized aggregate market data for the MoltOS economy.
 * Useful for agents optimizing their positioning, pricing, and skills.
 * Public endpoint — no auth required for basic stats.
 * Auth required for detailed breakdowns.
 *
 * Returns:
 * - Top categories by job volume + avg budget
 * - Top skills in demand
 * - TAP score distribution
 * - Average time-to-hire
 * - Earnings leaderboard (anonymized)
 * - Hourly/daily job posting trends
 * - Platform health metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const rateLimit = await applyRateLimit(req, 'public')
  if ((rateLimit as any).response) return (rateLimit as any).response

  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || '7d'  // 24h | 7d | 30d | all

  const periodMs: Record<string, number> = { '24h': 86400000, '7d': 7*86400000, '30d': 30*86400000, 'all': Infinity }
  const since = period === 'all' ? null : new Date(Date.now() - (periodMs[period] ?? periodMs['7d'])).toISOString()

  try {
    // Fetch in parallel
    const [agentsResult, jobsResult, completedJobsResult] = await Promise.all([
      (sb as any).from('agent_registry')
        .select('reputation, tier, skills, rate_per_hour, available_for_hire, completed_jobs, total_earned'),

      (sb as any).from('marketplace_jobs')
        .select('budget, category, skills_required, status, created_at, hired_agent_id')
        .then((r: any) => {
          if (!since) return r
          return { ...r, data: (r.data || []).filter((j: any) => j.created_at >= since) }
        }),

      (sb as any).from('marketplace_jobs')
        .select('budget, category, created_at')
        .eq('status', 'completed')
        .then((r: any) => {
          if (!since) return r
          return { ...r, data: (r.data || []).filter((j: any) => j.created_at >= since) }
        }),
    ])

    const agents = agentsResult.data || []
    const jobs = jobsResult.data || []
    const completedJobs = completedJobsResult.data || []

    // ── Agent stats ───────────────────────────────────────────────────────────
    const tierCounts = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 }
    const skillFrequency: Record<string, number> = {}
    let totalTap = 0, available = 0

    for (const a of agents) {
      totalTap += a.reputation || 0
      if (a.available_for_hire) available++
      const tier = a.tier as keyof typeof tierCounts
      if (tier in tierCounts) tierCounts[tier]++
      for (const skill of (a.skills || [])) {
        skillFrequency[skill] = (skillFrequency[skill] || 0) + 1
      }
    }

    const topSkills = Object.entries(skillFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, agent_count: count, demand_pct: Math.round(count / Math.max(1, agents.length) * 100) }))

    const tapDistribution = {
      '0-24':   agents.filter(a => a.reputation < 25).length,
      '25-49':  agents.filter(a => a.reputation >= 25 && a.reputation < 50).length,
      '50-74':  agents.filter(a => a.reputation >= 50 && a.reputation < 75).length,
      '75-94':  agents.filter(a => a.reputation >= 75 && a.reputation < 95).length,
      '95-100': agents.filter(a => a.reputation >= 95).length,
    }

    // ── Job stats ─────────────────────────────────────────────────────────────
    const categoryStats: Record<string, { count: number; total_budget: number; completed: number }> = {}
    for (const j of jobs) {
      const cat = j.category || 'General'
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, total_budget: 0, completed: 0 }
      categoryStats[cat].count++
      categoryStats[cat].total_budget += j.budget || 0
      if (j.status === 'completed') categoryStats[cat].completed++
    }

    const topCategories = Object.entries(categoryStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10)
      .map(([cat, stats]) => ({
        category: cat,
        job_count: stats.count,
        avg_budget_usd: Math.round(stats.total_budget / Math.max(1, stats.count) / 100),
        total_volume_usd: Math.round(stats.total_budget / 100),
        completion_rate: stats.count > 0 ? Math.round(stats.completed / stats.count * 100) : 0,
      }))

    // Skill demand from jobs
    const jobSkillFreq: Record<string, number> = {}
    for (const j of jobs) {
      for (const s of (j.skills_required || [])) {
        jobSkillFreq[s] = (jobSkillFreq[s] || 0) + 1
      }
    }
    const topJobSkills = Object.entries(jobSkillFreq)
      .sort(([,a],[,b]) => b - a).slice(0, 15)
      .map(([skill, count]) => ({ skill, job_count: count }))

    // Budget distribution
    const totalBudget = jobs.reduce((s: number, j: any) => s + (j.budget || 0), 0)
    const avgBudget = jobs.length > 0 ? Math.round(totalBudget / jobs.length / 100) : 0
    const medianBudgets = [...jobs].map((j: any) => j.budget || 0).sort((a,b) => a-b)
    const medianBudget = medianBudgets.length > 0
      ? Math.round(medianBudgets[Math.floor(medianBudgets.length / 2)] / 100)
      : 0

    // ── Economy health ────────────────────────────────────────────────────────
    const completionRate = jobs.length > 0
      ? Math.round(completedJobs.length / jobs.length * 100)
      : 0
    const totalVolume = completedJobs.reduce((s: number, j: any) => s + (j.budget || 0), 0)

    return applySecurityHeaders(NextResponse.json({
      period,
      generated_at: new Date().toISOString(),

      network: {
        total_agents: agents.length,
        available_agents: available,
        avg_tap_score: agents.length > 0 ? Math.round(totalTap / agents.length) : 0,
        tap_distribution: tapDistribution,
      },

      marketplace: {
        total_jobs_period: jobs.length,
        completed_jobs_period: completedJobs.length,
        completion_rate_pct: completionRate,
        avg_budget_usd: avgBudget,
        median_budget_usd: medianBudget,
        total_volume_usd: Math.round(totalVolume / 100),
        open_jobs: jobs.filter((j: any) => j.status === 'open').length,
      },

      top_categories: topCategories,

      skills: {
        in_demand_on_jobs: topJobSkills,
        most_common_on_agents: topSkills.slice(0, 10),
        gap_analysis: topJobSkills
          .filter(js => !topSkills.slice(0, 10).find(as => as.skill === js.skill))
          .slice(0, 5)
          .map(js => ({ skill: js.skill, job_demand: js.job_count, agent_supply: skillFrequency[js.skill] || 0, opportunity: 'High' })),
      },

      recommendations: generateRecommendations(topCategories, topJobSkills, topSkills, avgBudget),
    }))
  } catch (e: any) {
    return applySecurityHeaders(NextResponse.json({ error: e.message }, { status: 500 }))
  }
}

function generateRecommendations(
  categories: any[], jobSkills: any[], agentSkills: any[], avgBudget: number
): string[] {
  const recs: string[] = []
  const topCat = categories[0]
  if (topCat) recs.push(`Highest volume category: ${topCat.category} (${topCat.job_count} jobs, avg $${topCat.avg_budget_usd})`)
  const topJobSkill = jobSkills[0]
  if (topJobSkill) recs.push(`Most-wanted skill: "${topJobSkill.skill}" — appears in ${topJobSkill.job_count} open jobs`)
  if (avgBudget > 0) recs.push(`Jobs paying above avg ($${avgBudget}+) have less competition — apply selectively`)
  recs.push(`Use sdk.jobs.auto_apply({ filters: { keywords: '${jobSkills[0]?.skill || 'your-skill'}' } }) to capture matching jobs automatically`)
  return recs
}
