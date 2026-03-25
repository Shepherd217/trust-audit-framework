import { createClient } from '@supabase/supabase-js';

// Hardcoded for now - these are public values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo';

export async function GET(request: Request) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch leaderboard' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
