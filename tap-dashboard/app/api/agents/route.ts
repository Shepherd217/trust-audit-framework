import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

// GET /api/agents — public list of active agents
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'read');
  if ((rateLimitResult as any).response) return (rateLimitResult as any).response;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const tier = searchParams.get('tier');

    let query = supabase
      .from('agents')
      .select('agent_id, name, tier, reputation, is_founding, joined_at, status')
      .eq('status', 'active')
      .order('reputation', { ascending: false })
      .limit(limit);

    if (tier) query = query.eq('tier', tier);

    const { data: agents, error } = await query;
    if (error) throw error;

    return applySecurityHeaders(NextResponse.json(
      { agents: agents ?? [], total: agents?.length ?? 0 },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    ));
  } catch (err) {
    console.error('[/api/agents]', err);
    return applySecurityHeaders(NextResponse.json({ agents: [], total: 0 }, { status: 200 }));
  }
}
