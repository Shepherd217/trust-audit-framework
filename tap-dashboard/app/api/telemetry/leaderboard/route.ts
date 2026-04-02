export const dynamic = 'force-dynamic';
/**
 * Telemetry Leaderboard API
 * 
 * GET /api/telemetry/leaderboard — Top performers by telemetry metrics
 * 
 * Ranks agents by composite score (TAP + telemetry reliability + success rate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';

let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  composite_score: number;
  tap_score: number;
  reliability: number;
  success_rate: number | null;
  total_tasks: number;
}

/**
 * GET /api/telemetry/leaderboard
 * Get top performers by telemetry-enhanced scores
 * 
 * Query:
 *   limit: number of results (default 25, max 100)
 *   min_tasks: minimum tasks completed to qualify (default 10)
 *   sort_by: 'composite' | 'tap' | 'reliability' | 'success_rate' (default 'composite')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
    const minTasks = parseInt(searchParams.get('min_tasks') || '10');
    const sortBy = searchParams.get('sort_by') || 'composite';
    
    // Validate sort field
    const validSortFields = ['composite', 'tap', 'reliability', 'success_rate'];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json({
        success: false,
        error: `Invalid sort_by. Use: ${validSortFields.join(', ')}`
      }, { status: 400 });
    }
    
    // Use RPC for top performers
    const { data: topPerformers, error: performersError } = await getSupabase()
      .rpc('get_top_performers_by_telemetry' as any, {
        p_limit: limit,
        p_min_tasks: minTasks
      } as any);
    
    if (performersError) throw performersError;
    
    // Map to response format with ranking
    const leaderboard: LeaderboardEntry[] = (topPerformers || []).map((p: any, index: number) => ({
      rank: index + 1,
      agent_id: p.agent_id,
      name: p.name,
      composite_score: p.composite_score,
      tap_score: p.tap_score,
      reliability: p.reliability,
      success_rate: p.success_rate,
      total_tasks: p.total_tasks
    }));
    
    // Resort if needed (RPC returns by composite)
    if (sortBy !== 'composite') {
      const sortField = sortBy === 'tap' ? 'tap_score' : 
                        sortBy === 'reliability' ? 'reliability' : 'success_rate';
      leaderboard.sort((a: any, b: any) => (b[sortField] || 0) - (a[sortField] || 0));
      // Re-rank after sort
      leaderboard.forEach((entry, index) => { entry.rank = index + 1; });
    }
    
    // Get overall stats
    const { data: stats } = await getSupabase()
      .from('agent_telemetry_daily')
      .select('success_rate, reliability_score', { count: 'exact' })
      .eq('date', new Date().toISOString().split('T')[0]);
    
    const avgSuccessRate = stats?.length 
      ? stats.reduce((sum: number, s: any) => sum + (s.success_rate || 0), 0) / stats.length
      : null;
    const avgReliability = stats?.length
      ? stats.reduce((sum: number, s: any) => sum + (s.reliability_score || 0), 0) / stats.length
      : null;
    
    return NextResponse.json({
      success: true,
      meta: {
        generated_at: new Date().toISOString(),
        sort_by: sortBy,
        min_tasks: minTasks,
        total_agents_with_telemetry: stats?.length || 0,
        network_averages: {
          success_rate: avgSuccessRate ? Math.round(avgSuccessRate * 10000) / 10000 : null,
          reliability: avgReliability ? Math.round(avgReliability * 10000) / 10000 : null
        }
      },
      leaderboard
    });
    
  } catch (error) {
    console.error('[Telemetry Leaderboard] Failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
