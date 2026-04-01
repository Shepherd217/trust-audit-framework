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
 * POST /api/arbitra/recovery
 * Start a reputation recovery program
 * 
 * Body:
 * {
 *   agent_id: string,
 *   target_reputation: number,  -- Goal to reach
 *   recovery_type: 'good_behavior' | 'service_contribution' | 'community_service'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, target_reputation, recovery_type = 'good_behavior' } = body;

    if (!agent_id || !target_reputation) {
      return NextResponse.json({
        success: false,
        error: 'agent_id and target_reputation required'
      }, { status: 400 });
    }

    // Get current reputation
    const { data: agent } = await getSupabase()
      .from('agent_registry')
      .select('reputation, activation_status')
      .eq('agent_id', agent_id)
      .single();

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 });
    }

    if (target_reputation <= (agent.reputation || 0)) {
      return NextResponse.json({
        success: false,
        error: 'Target must be higher than current reputation'
      }, { status: 400 });
    }

    // Check not already in recovery
    const { data: existing } = await getSupabase()
      .from('reputation_recovery')
      .select('id')
      .eq('agent_id', agent_id)
      .eq('status', 'active')
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Already in active recovery program'
      }, { status: 400 });
    }

    // Calculate required contributions based on gap
    const reputationGap = target_reputation - (agent.reputation || 0);
    const contributionsRequired = Math.ceil(reputationGap / 50); // 50 rep per contribution

    const { data: recovery, error } = await getSupabase()
      .from('reputation_recovery')
      .insert([{
        agent_id,
        target_reputation,
        current_reputation: agent.reputation || 0,
        recovery_type,
        contributions_required: contributionsRequired,
        status: 'active',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      recovery_id: recovery.id,
      message: 'Recovery program started',
      details: {
        current: agent.reputation || 0,
        target: target_reputation,
        gap: reputationGap,
        estimated_days: Math.ceil(reputationGap / 5), // 5 per day base
        contributions_needed: contributionsRequired
      }
    });

  } catch (error) {
    console.error('Recovery start error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start recovery'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/arbitra/recovery
 * Record a contribution or update progress
 * 
 * Body:
 * {
 *   recovery_id: string,
 *   action: 'contribution' | 'daily_check',
 *   contribution_proof?: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { recovery_id, action, contribution_proof } = body;

    if (!recovery_id || !action) {
      return NextResponse.json({
        success: false,
        error: 'recovery_id and action required'
      }, { status: 400 });
    }

    const { data: recovery } = await getSupabase()
      .from('reputation_recovery')
      .select('*')
      .eq('id', recovery_id)
      .single();

    if (!recovery || recovery.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Recovery not found or not active'
      }, { status: 404 });
    }

    if (action === 'contribution') {
      // Record contribution
      const { error } = await getSupabase()
        .from('reputation_recovery')
        .update({
          contributions_completed: recovery.contributions_completed + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', recovery_id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Contribution recorded',
        progress: `${recovery.contributions_completed + 1}/${recovery.contributions_required}`
      });
    }

    if (action === 'daily_check') {
      // Run daily recovery calculation
      const { data: gained, error } = await getSupabase()
        .rpc('calculate_daily_recovery' as any, { p_agent_id: recovery.agent_id } as any);

      if (error) throw error;

      // Get updated status
      const { data: updated } = await getSupabase()
        .from('reputation_recovery')
        .select('*')
        .eq('id', recovery_id)
        .single();

      if (!updated) throw new Error('Recovery record not found after update')
      return NextResponse.json({
        success: true,
        reputation_gained_today: gained,
        current_reputation: updated.current_reputation,
        target_reputation: updated.target_reputation,
        good_behavior_days: updated.good_behavior_days,
        status: updated.status,
        completed: updated.status === 'completed'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Recovery update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update recovery'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/recovery
 * Get recovery status
 * 
 * Query: agent_id required
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'agent_id required'
      }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('reputation_recovery')
      .select(`
        *,
        agent:agent_id (agent_id, name, reputation)
      `)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recovery data'
      }, { status: 500 });
    }

    const active = data?.find((r: any) => r.status === 'active');

    return NextResponse.json({
      success: true,
      history: data,
      active_recovery: active || null,
      can_start_new: !active
    });

  } catch (error) {
    console.error('Recovery fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch recovery data'
    }, { status: 500 });
  }
}
