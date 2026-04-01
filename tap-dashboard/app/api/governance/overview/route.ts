import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

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

/**
 * GET /api/governance/overview
 * Dashboard overview metrics for governance
 * 
 * Query:
 *   days: number (default 7) -- time window for metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

    // Get overview metrics from view
    const { data: overview, error: overviewError } = await getSupabase()
      .from('v_governance_overview')
      .select('*');

    if (overviewError) throw overviewError;

    // Get active cases requiring attention
    const { data: activeCases, error: casesError } = await getSupabase()
      .from('v_cases_requiring_action')
      .select('*')
      .limit(20);

    if (casesError) throw casesError;

    // Get recent activity stats
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      { count: newAgents },
      { count: newAttestations },
      { count: newVouches },
      { count: slashEvents }
    ] = await Promise.all([
      getSupabase().from('agent_registry').select('*', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
      getSupabase().from('attestations').select('*', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
      getSupabase().from('agent_vouches').select('*', { count: 'exact', head: true }).gte('created_at', since.toISOString()),
      getSupabase().from('slash_events').select('*', { count: 'exact', head: true }).gte('created_at', since.toISOString())
    ]);

    // Network health score (0-100)
    const metrics = overview || [];
    const pendingDisputes = metrics.find((m: any) => m.metric_type === 'disputes')?.pending || 0;
    const pendingAppeals = metrics.find((m: any) => m.metric_type === 'appeals')?.pending || 0;
    const openAnomalies = metrics.find((m: any) => m.metric_type === 'anomalies')?.pending || 0;

    // Simple health formula: lower pending = higher health
    const totalPending = pendingDisputes + pendingAppeals + openAnomalies;
    const healthScore = Math.max(0, 100 - (totalPending * 5));

    return NextResponse.json({
      success: true,
      overview: {
        metrics: metrics.reduce((acc: any, m: any) => {
          acc[m.metric_type] = {
            total: m.total,
            pending: m.pending,
            resolved: m.resolved,
            last_24h: m.last_24h
          };
          return acc;
        }, {}),
        health_score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'attention' : 'critical'
      },
      activity: {
        period_days: days,
        new_agents: newAgents || 0,
        new_attestations: newAttestations || 0,
        new_vouches: newVouches || 0,
        slash_events: slashEvents || 0
      },
      active_cases: activeCases || [],
      pending_count: {
        disputes: pendingDisputes,
        appeals: pendingAppeals,
        anomalies: openAnomalies,
        total: totalPending
      }
    });

  } catch (error) {
    console.error('Governance overview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch governance overview'
    }, { status: 500 });
  }
}
