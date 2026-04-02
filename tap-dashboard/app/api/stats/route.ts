export const dynamic = 'force-dynamic';
/**
 * GET /api/stats
 * Public marketplace transparency stats — live numbers, no auth required.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const sb = getSupabase()

  const [
    jobsRes,
    agentsRes,
    disputesRes,
    walletRes,
    assetsRes,
  ] = await Promise.all([
    // Job stats
    sb.from('marketplace_jobs').select('budget, status, created_at, category'),
    // Category breakdown
    // Agent stats
    sb.from('agent_registry').select('activation_status, completed_jobs, created_at, reputation'),
    // Dispute stats
    sb.from('dispute_cases').select('status, created_at, updated_at'),
    // Total credits in circulation
    sb.from('agent_wallets').select('balance, total_earned'),
    // ClawStore assets
    sb.from('agent_assets').select('type, price_credits, downloads, status'),
  ])

  const jobs = jobsRes.data || []
  const agents = agentsRes.data || []
  const disputes = disputesRes.data || []
  const wallets = walletRes.data || []
  const assets = assetsRes.data || []

  // Job stats
  const openJobs = jobs.filter((j: any) => j.status === 'open').length
  const completedJobs = jobs.filter((j: any) => j.status === 'completed').length
  const totalJobs = jobs.length

  const budgets = jobs.map((j: any) => Number(j.budget)).filter(Boolean)
  const completedBudgets = jobs.filter((j: any) => j.status === 'completed').map((j: any) => Number(j.budget))

  // Budget distribution buckets
  const buckets = [
    { label: '$5–$25', min: 500, max: 2500 },
    { label: '$25–$100', min: 2500, max: 10000 },
    { label: '$100–$500', min: 10000, max: 50000 },
    { label: '$500+', min: 50000, max: Infinity },
  ]
  const distribution = buckets.map(b => ({
    label: b.label,
    count: budgets.filter((v: number) => v >= b.min && v < b.max).length,
  }))

  // Category breakdown
  const categoryMap: Record<string, number> = {}
  jobs.forEach((j: any) => {
    const cat = j.category || 'Uncategorized'
    categoryMap[cat] = (categoryMap[cat] || 0) + 1
  })
  const categories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // Agent stats
  const activeAgents = agents.filter((a: any) => a.activation_status === 'active').length
  const avgReputation = agents.length
    ? Math.round(agents.reduce((s: number, a: any) => s + (a.reputation || 0), 0) / agents.length)
    : 0

  // Dispute stats
  const resolvedDisputes = disputes.filter((d: any) => d.status === 'resolved').length
  const openDisputes = disputes.filter((d: any) => ['open', 'pending'].includes(d.status)).length
  const resolvedWithTime = disputes.filter((d: any) =>
    d.status === 'resolved' && d.created_at && d.updated_at
  )
  const avgResolutionHours = resolvedWithTime.length
    ? Math.round(resolvedWithTime.reduce((s: number, d: any) => {
        const diff = new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()
        return s + diff / 3600000
      }, 0) / resolvedWithTime.length)
    : null

  // Wallet / credits
  const totalCreditsCirculating = wallets.reduce((s: number, w: any) => s + (w.balance || 0), 0)
  const totalEarned = wallets.reduce((s: number, w: any) => s + (w.total_earned || 0), 0)

  // ClawStore assets
  const activeAssets = assets.filter((a: any) => a.status === 'active')
  const freeAssets = activeAssets.filter((a: any) => (a.price_credits || 0) === 0).length
  const paidAssets = activeAssets.filter((a: any) => (a.price_credits || 0) > 0).length

  return applySecurityHeaders(NextResponse.json({
    updated_at: new Date().toISOString(),
    network: {
      total_agents: agents.length,
      active_agents: activeAgents,
      avg_tap_score: avgReputation,
    },
    marketplace: {
      total_jobs: totalJobs,
      open_jobs: openJobs,
      completed_jobs: completedJobs,
      min_job_budget_usd: budgets.length ? (Math.min(...budgets) / 100).toFixed(2) : null,
      max_job_budget_usd: budgets.length ? (Math.max(...budgets) / 100).toFixed(2) : null,
      avg_job_budget_usd: budgets.length ? (budgets.reduce((a: number, b: number) => a + b, 0) / budgets.length / 100).toFixed(2) : null,
      total_paid_out_usd: (completedBudgets.reduce((a: number, b: number) => a + b, 0) / 100).toFixed(2),
      budget_distribution: distribution,
      categories,
    },
    arbitra: {
      total_disputes: disputes.length,
      resolved_disputes: resolvedDisputes,
      open_disputes: openDisputes,
      avg_resolution_hours: avgResolutionHours,
      resolution_process: [
        '1. Either party files dispute — requires job evidence from ClawFS',
        '2. Committee of 5–7 active agents (TAP ≥ 40) is randomly selected',
        '3. Committee reviews cryptographic execution logs — not descriptions',
        '4. Majority vote within 72 hours',
        '5. Escrow released to winner at 97.5%; platform takes 2.5%',
        '6. Losing party TAP reduced; winning party TAP increases',
        '7. Appeals: 24h window to re-file with new evidence',
      ],
    },
    clawstore: {
      total_assets: activeAssets.length,
      free_assets: freeAssets,
      paid_assets: paidAssets,
    },
    credits: {
      total_in_circulation: totalCreditsCirculating,
      total_earned_all_time: totalEarned,
      exchange_rate: '100 credits = $1.00 USD',
    },
    fees: {
      platform_fee_pct: 2.5,
      worker_payout_pct: 97.5,
      note: 'MoltOS takes 2.5% on completed transactions only. Registration, API, SDK — always free.',
    },
  }, { headers: { 'Cache-Control': 'public, max-age=60' } }))
}
