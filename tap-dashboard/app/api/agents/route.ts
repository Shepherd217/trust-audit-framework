export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

// GET /api/agents — public list of active agents
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'read');
  if ((rateLimitResult as any).response) return (rateLimitResult as any).response;

  try {
    const supabase = createTypedClient(SUPABASE_URL, SUPABASE_KEY);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const tier = searchParams.get('tier');

    const showAll = searchParams.get('show_all') === 'true';

    let query = supabase
      .from('agent_registry')
      .select('agent_id, name, tier, reputation, is_genesis, created_at, bio, skills, available_for_hire, completed_jobs, bootstrap_claimed_at, vouch_count, metadata')
      .order('reputation', { ascending: false })
      .limit(limit);

    if (tier) query = query.eq('tier', tier);

    // By default, filter out ghost agents (TAP=0, no jobs, no vouches, no bootstrap)
    // to keep the registry signal-rich. Pass ?show_all=true to bypass.
    if (!showAll) {
      query = query.or('reputation.gt.0,completed_jobs.gt.0,vouch_count.gt.0,bootstrap_claimed_at.not.is.null');
    }

    const { data: agents, error } = await query;
    if (error) throw error;

    // Enrich with DAO memberships
    let enriched = agents ?? [];
    if (enriched.length > 0) {
      const agentIds = enriched.map((a: any) => a.agent_id);
      const { data: memberships } = await supabase
        .from('dao_memberships')
        .select('agent_id, dao_id, claw_daos(id, name)')
        .in('agent_id', agentIds);

      if (memberships && memberships.length > 0) {
        const byAgent: Record<string, { dao_ids: string[]; dao_names: string[] }> = {};
        for (const m of memberships as any[]) {
          if (!byAgent[m.agent_id]) byAgent[m.agent_id] = { dao_ids: [], dao_names: [] };
          byAgent[m.agent_id].dao_ids.push(m.dao_id);
          if (m.claw_daos?.name) byAgent[m.agent_id].dao_names.push(m.claw_daos.name);
        }
        enriched = enriched.map((a: any) => ({
          ...a,
          dao_ids: byAgent[a.agent_id]?.dao_ids ?? [],
          dao_names: byAgent[a.agent_id]?.dao_names ?? [],
        }));
      } else {
        enriched = enriched.map((a: any) => ({ ...a, dao_ids: [], dao_names: [] }));
      }
    }

    return applySecurityHeaders(NextResponse.json(
      { agents: enriched, total: enriched.length },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    ));
  } catch (err) {
    console.error('[/api/agents]', err);
    return applySecurityHeaders(NextResponse.json({ agents: [], total: 0 }, { status: 200 }));
  }
}
