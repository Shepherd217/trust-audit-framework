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

/**
 * POST /api/arbitra/appeal/resolve
 * Resolve an appeal (admin/genesis only, or auto-resolve)
 * 
 * Body:
 * {
 *   appeal_id: string,
 *   action: 'auto' | 'accept' | 'reject',  -- auto uses vote count
 *   resolver_id: string  -- required for manual, optional for auto
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appeal_id, action = 'auto', resolver_id } = body;

    if (!appeal_id) {
      return NextResponse.json({
        success: false,
        error: 'appeal_id required'
      }, { status: 400 });
    }

    let result;

    if (action === 'auto') {
      // Auto-resolve based on votes
      const { data, error } = await getSupabase()
        .rpc('process_appeal_resolution' as any, { p_appeal_id: appeal_id } as any);

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      result = data;
    } else {
      // Manual resolution
      if (!resolver_id) {
        return NextResponse.json({
          success: false,
          error: 'resolver_id required for manual resolution'
        }, { status: 400 });
      }

      const { data, error } = await getSupabase()
        .rpc('resolve_appeal_manually' as any, {
          p_appeal_id: appeal_id,
          p_resolver_id: resolver_id,
          p_force_result: action
        } as any);

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 });
      }

      result = data;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Appeal resolve error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to resolve appeal'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/appeal/resolve
 * Get appeal resolution status and pending appeals
 * 
 * Query:
 *   appeal_id: specific appeal
 *   pending: boolean - only appeals ready for resolution
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appealId = searchParams.get('appeal_id');
    const pending = searchParams.get('pending') === 'true';

    if (appealId) {
      const { data, error } = await getSupabase()
        .from('appeals')
        .select(`
          *,
          appellant:appellant_id (agent_id, name, reputation)
        `)
        .eq('id', appealId)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Appeal not found'
        }, { status: 404 });
      }

      // Calculate if ready for resolution
      const canResolve = data.status === 'voting' && 
        (data.voting_ends_at ? new Date(data.voting_ends_at) < new Date() : false);

      return NextResponse.json({
        success: true,
        appeal: data,
        can_resolve: canResolve,
        vote_summary: {
          yes_votes: data.yes_votes,
          no_votes: data.no_votes,
          total: data.yes_votes + data.no_votes,
          yes_percent: data.yes_votes + data.no_votes > 0 
            ? Math.round((data.yes_votes / (data.yes_votes + data.no_votes)) * 100)
            : 0
        }
      });
    }

    if (pending) {
      // Get appeals ready for resolution
      const { data, error } = await getSupabase()
        .from('appeals')
        .select(`
          *,
          appellant:appellant_id (agent_id, name)
        `)
        .eq('status', 'voting')
        .lt('voting_ends_at', new Date().toISOString())
        .order('voting_ends_at', { ascending: true });

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch pending appeals'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        pending_appeals: data,
        count: data?.length || 0
      });
    }

    // Default: get stats
    const { data: stats } = await getSupabase()
      .from('appeals')
      .select('status');

    const summary = {
      total: stats?.length || 0,
      pending: stats?.filter(s => s.status === 'pending').length || 0,
      voting: stats?.filter(s => s.status === 'voting').length || 0,
      accepted: stats?.filter(s => s.status === 'accepted').length || 0,
      rejected: stats?.filter(s => s.status === 'rejected').length || 0,
      expired: stats?.filter(s => s.status === 'expired').length || 0
    };

    return NextResponse.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Appeal status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch appeal status'
    }, { status: 500 });
  }
}
