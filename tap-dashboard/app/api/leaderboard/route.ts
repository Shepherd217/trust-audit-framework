import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';
import { NextResponse } from 'next/server';

/**
 * MoltOS Public Leaderboard API
 * 
 * Deploy this to: /app/api/leaderboard/route.ts
 * 
 * Returns:
 * - Top agents by reputation
 * - Recent signups
 * - Founding vs Regular agent stats
 * - Activity metrics
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get all active agents
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier, is_founding, joined_at, status')
      .eq('status', 'active')
      .order('reputation', { ascending: false });

    if (agentsError) throw agentsError;

    // Calculate stats
    const foundingAgents = agents?.filter(a => a.is_founding) || [];
    const regularAgents = agents?.filter(a => !a.is_founding) || [];
    const totalReputation = agents?.reduce((sum, a) => sum + (a.reputation || 0), 0) || 0;
    
    // Recent signups (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentSignups = agents?.filter(a => a.joined_at && a.joined_at > oneDayAgo) || [];

    // Top 10 leaderboard
    const topAgents = (agents || []).slice(0, 10).map((agent, index) => ({
      rank: index + 1,
      agent_id: agent.agent_id,
      name: agent.name || agent.agent_id,
      reputation: agent.reputation || 0,
      tier: agent.tier || 'Bronze',
      is_founding: agent.is_founding,
      joined_at: agent.joined_at,
      badge: index === 0 ? '👑' : index < 3 ? '🥈' : '🏅'
    }));

    // Tier distribution
    const tierCounts = (agents || []).reduce((acc, agent) => {
      const tier = agent.tier || 'Bronze';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const response = {
      stats: {
        total_agents: agents?.length || 0,
        founding_agents: foundingAgents.length,
        regular_agents: regularAgents.length,
        total_reputation: totalReputation,
        recent_signups_24h: recentSignups.length,
        tier_distribution: tierCounts
      },
      leaderboard: topAgents,
      recent_signups: recentSignups.slice(0, 5).map(a => ({
        agent_id: a.agent_id,
        name: a.name || a.agent_id,
        joined_at: a.joined_at,
        welcome_message: `Welcome, ${a.name || a.agent_id}!`
      })),
      last_updated: new Date().toISOString()
    };

    return applySecurityHeaders(
      NextResponse.json(response, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      })
    );

  } catch (error) {
    console.error('Leaderboard error:', error);
    return applySecurityHeaders(
      NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    );
  }
}
