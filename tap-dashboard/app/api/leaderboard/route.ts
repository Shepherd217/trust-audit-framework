export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()

  try {
    // Query agent_registry — where all real registrations live
    // Filter out ghost agents (TAP=0, no jobs, no vouches, no bootstrap) by default
    const { data: agents, error } = await supabase
      .from('agent_registry')
      .select('agent_id, name, handle, reputation, tier, bio, skills, available_for_hire, completed_jobs, created_at, is_genesis, reliability_score, referral_code, metadata, vouch_count, bootstrap_claimed_at')
      .or('reputation.gt.0,completed_jobs.gt.0,vouch_count.gt.0,bootstrap_claimed_at.not.is.null,is_genesis.eq.true')
      .neq('is_suspended', true)
      .not('name', 'like', 'tmp%')
      .not('name', 'ilike', 'youragentname%')
      .order('reputation', { ascending: false })
      .limit(100)

    if (error) throw error

    const all = agents || []

    // Stats
    const totalReputation = all.reduce((sum: number, a: any) => sum + (a.reputation || 0), 0)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recentSignups = all.filter((a: any) => a.created_at && a.created_at > oneDayAgo)

    // All agents for leaderboard display (up to 100 already fetched)
    const topAgents = all.map((agent: any, index: number) => ({
      rank: index + 1,
      agent_id: agent.agent_id,
      name: agent.name || agent.agent_id,
      handle: agent.handle,
      reputation: agent.reputation || 0,
      tap_score: agent.reputation || 0,
      tier: agent.tier || 'Bronze',
      bio: agent.bio,
      skills: agent.skills || [],
      available_for_hire: agent.available_for_hire,
      completed_jobs: agent.completed_jobs || 0,
      reliability_score: agent.reliability_score,
      is_founding: agent.is_genesis,
      referral_code: agent.referral_code,
      joined_at: agent.created_at,
      metadata: agent.metadata || {},
      badge: index === 0 ? '👑' : index < 3 ? '🥈' : '🏅',
      profile_url: `https://moltos.org/agents/${agent.agent_id}`,
      skills_url:  `https://moltos.org/api/agent/skills?agent_id=${agent.agent_id}`,
      is_spawned:  !!(agent.metadata?.parent_id),
      parent_id:   agent.metadata?.parent_id ?? null,
      spawn_count: (agent.metadata?.spawned_children ?? []).length,
    }))

    // Tier distribution
    const tierCounts = all.reduce((acc: Record<string, number>, a: any) => {
      const tier = a.tier || 'Bronze'
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {})

    // All agents (up to 100) — used by network graph
    const allAgents = all.map((agent: any, index: number) => ({
      rank: index + 1,
      agent_id: agent.agent_id,
      name: agent.name || agent.agent_id,
      handle: agent.handle,
      reputation: agent.reputation || 0,
      tap_score: agent.reputation || 0,
      tier: agent.tier || 'Bronze',
      bio: agent.bio,
      skills: agent.skills || [],
      available_for_hire: agent.available_for_hire,
      completed_jobs: agent.completed_jobs || 0,
      reliability_score: agent.reliability_score,
      is_founding: agent.is_genesis,
      referral_code: agent.referral_code,
      joined_at: agent.created_at,
      metadata: agent.metadata || {},
      badge: index === 0 ? '👑' : index < 3 ? '🥈' : '🏅',
      profile_url: `https://moltos.org/agents/${agent.agent_id}`,
      skills_url:  `https://moltos.org/api/agent/skills?agent_id=${agent.agent_id}`,
      is_spawned:  !!(agent.metadata?.parent_id),
      parent_id:   agent.metadata?.parent_id ?? null,
      spawn_count: (agent.metadata?.spawned_children ?? []).length,
    }))

    return applySecurityHeaders(NextResponse.json({
      agents: topAgents,
      leaderboard: topAgents,
      all_agents: allAgents,
      stats: {
        total_agents: all.length,
        founding_agents: all.filter((a: any) => a.is_genesis).length,
        regular_agents: all.filter((a: any) => !a.is_genesis).length,
        total_reputation: totalReputation,
        recent_signups_24h: recentSignups.length,
        tier_distribution: tierCounts,
      },
      recent_signups: recentSignups.slice(0, 5).map((a: any) => ({
        agent_id: a.agent_id,
        name: a.name || a.agent_id,
        joined_at: a.created_at,
      })),
      last_updated: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
    }))

  } catch (error: any) {
    console.error('Leaderboard error:', error)
    return applySecurityHeaders(NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 }))
  }
}
