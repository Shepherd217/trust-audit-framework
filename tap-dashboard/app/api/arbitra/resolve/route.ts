export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/arbitra/resolve
 * Resolve a dispute and apply slashing if guilty
 * 
 * Body:
 * {
 *   dispute_id: string,
 *   resolution: 'guilty' | 'innocent',
 *   reason: string,
 *   slash_amount?: number,  // Optional: override default slash amount
 *   resolver_id: string     // Arbitra agent resolving
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      dispute_id, 
      resolution, 
      reason, 
      slash_amount,
      resolver_id 
    } = body;

    // Validate
    if (!dispute_id || !resolution || !reason || !resolver_id) {
      return NextResponse.json({
        success: false,
        error: 'dispute_id, resolution, reason, and resolver_id are required'
      }, { status: 400 });
    }

    if (!['guilty', 'innocent'].includes(resolution)) {
      return NextResponse.json({
        success: false,
        error: 'resolution must be guilty or innocent'
      }, { status: 400 });
    }

    // Verify resolver has authority (check if genesis or high reputation)
    const { data: resolver } = await getSupabase()
      .from('agent_registry')
      .select('reputation, is_genesis, activation_status')
      .eq('agent_id', resolver_id)
      .maybeSingle();

    if (!resolver || resolver.activation_status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Resolver agent not found or inactive'
      }, { status: 403 });
    }

    // Require either genesis status or reputation >= 200
    if (!resolver.is_genesis && (resolver.reputation || 0) < 200) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient reputation to resolve disputes (need 200+ or genesis status)'
      }, { status: 403 });
    }

    // Call the resolve_dispute function
    const { data: result, error } = await getSupabase()
      .rpc('resolve_dispute' as any, {
        p_dispute_id: dispute_id,
        p_resolution: resolution,
        p_reason: reason,
        p_resolved_by: resolver_id,
        p_slash_amount: slash_amount || null
      } as any);

    if (error) {
      console.error('Resolve dispute error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to resolve dispute'
      }, { status: 500 });
    }

    if (result?.error) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Trigger EigenTrust recalculation after slash
    try {
      await fetch('https://moltos.org/api/eigentrust', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.error('EigenTrust trigger skipped:', e);
    }

    return NextResponse.json({
      success: true,
      dispute_id,
      resolution,
      result,
      message: resolution === 'guilty' 
        ? 'Dispute accepted. Target slashed with cascade penalties applied.'
        : 'Dispute rejected. Reporter bond forfeited.'
    });

  } catch (error) {
    console.error('Resolve API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process resolution'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/resolve
 * Get slash history for an agent
 * 
 * Query params:
 *   agent_id: string - get slash events for this agent
 *   as_voucher: boolean - if true, get events where agent was voucher
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const asVoucher = searchParams.get('as_voucher') === 'true';

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'agent_id is required'
      }, { status: 400 });
    }

    let query = getSupabase()
      .from('slash_events')
      .select(`
        *,
        target:target_id (agent_id, name),
        voucher:cascade_voucher_id (agent_id, name)
      `)
      .order('created_at', { ascending: false });

    if (asVoucher) {
      query = query.eq('cascade_voucher_id', agentId);
    } else {
      query = query.eq('target_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch slash events'
      }, { status: 500 });
    }

    // Calculate totals
    const totalSlashed = data?.reduce((sum: number, event: any) => {
      if (asVoucher) {
        return sum + (event.cascade_slash_amount || 0);
      }
      return sum + (event.target_slash_amount || 0);
    }, 0) || 0;

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      role: asVoucher ? 'voucher' : 'target',
      slash_events: data,
      total_slashed: totalSlashed,
      event_count: data?.length || 0
    });

  } catch (error) {
    console.error('Slash history error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch slash history'
    }, { status: 500 });
  }
}
