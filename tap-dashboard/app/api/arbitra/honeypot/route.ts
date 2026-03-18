import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/arbitra/honeypot
 * Deploy a new honeypot agent
 * 
 * Body:
 * {
 *   name: string,
 *   bait_type: 'reputation_grab' | 'collusion_bait' | 'sybil_trap' | 'suspicious_behavior',
 *   fake_reputation: number,
 *   fake_role: string,
 *   expected_attacks: string[],
 *   deployed_by: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      bait_type = 'reputation_grab',
      fake_reputation = 500,
      fake_role = 'standard',
      expected_attacks = [],
      deployed_by 
    } = body;

    if (!name || !deployed_by) {
      return NextResponse.json({
        success: false,
        error: 'name and deployed_by are required'
      }, { status: 400 });
    }

    // Verify deployer is genesis or high reputation
    const { data: deployer } = await getSupabase()
      .from('agent_registry')
      .select('is_genesis, reputation, activation_status')
      .eq('agent_id', deployed_by)
      .single();

    if (!deployer || deployer.activation_status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Deployer not found or inactive'
      }, { status: 403 });
    }

    if (!deployer.is_genesis && (deployer.reputation || 0) < 500) {
      return NextResponse.json({
        success: false,
        error: 'Need 500+ reputation or genesis status to deploy honeypots'
      }, { status: 403 });
    }

    // Generate fake agent ID
    const honeypotId = `honeypot_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    const publicKey = `hp_pk_${Math.random().toString(36).substr(2, 10)}`;

    const { data: honeypot, error } = await getSupabase()
      .from('honeypot_agents')
      .insert([{
        agent_id: honeypotId,
        name,
        public_key: publicKey,
        bait_type,
        fake_reputation,
        fake_role,
        expected_attacks,
        deployed_by,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      console.error('Honeypot creation error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to deploy honeypot'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      honeypot_id: honeypotId,
      message: 'Honeypot deployed successfully',
      honeypot: {
        id: honeypot.id,
        agent_id: honeypotId,
        name,
        bait_type,
        fake_reputation
      }
    });

  } catch (error) {
    console.error('Honeypot API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to deploy honeypot'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/honeypot
 * List honeypots or get specific honeypot
 * 
 * Query params:
 *   honeypot_id: string (optional)
 *   status: 'active' | 'triggered' | 'retired' (optional)
 *   triggered_only: boolean (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const honeypotId = searchParams.get('honeypot_id');
    const status = searchParams.get('status');
    const triggeredOnly = searchParams.get('triggered_only') === 'true';

    if (honeypotId) {
      const { data, error } = await getSupabase()
        .from('honeypot_agents')
        .select(`
          *,
          deployer:deployed_by (agent_id, name)
        `)
        .eq('id', honeypotId)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Honeypot not found'
        }, { status: 404 });
      }

      return NextResponse.json({ success: true, honeypot: data });
    }

    let query = getSupabase()
      .from('honeypot_agents')
      .select(`
        *,
        deployer:deployed_by (agent_id, name)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (triggeredOnly) query = query.eq('status', 'triggered');

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch honeypots'
      }, { status: 500 });
    }

    // Calculate stats
    const stats = {
      total: data?.length || 0,
      active: data?.filter(h => h.status === 'active').length || 0,
      triggered: data?.filter(h => h.status === 'triggered').length || 0,
      retired: data?.filter(h => h.status === 'retired').length || 0
    };

    return NextResponse.json({ 
      success: true, 
      honeypots: data,
      stats
    });

  } catch (error) {
    console.error('Honeypot fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch honeypots'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/arbitra/honeypot
 * Update honeypot status (trigger, retire)
 * 
 * Body:
 * {
 *   honeypot_id: string,
 *   status: 'triggered' | 'retired',
 *   triggered_by?: string,
 *   evidence?: object
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { honeypot_id, status, triggered_by, evidence } = body;

    if (!honeypot_id || !status) {
      return NextResponse.json({
        success: false,
        error: 'honeypot_id and status are required'
      }, { status: 400 });
    }

    const updates: any = { status };
    
    if (status === 'triggered' && triggered_by) {
      updates.triggered_at = new Date().toISOString();
      updates.triggered_by = triggered_by;
      if (evidence) {
        updates.trigger_evidence = evidence;
      }
    }

    const { data, error } = await getSupabase()
      .from('honeypot_agents')
      .update(updates)
      .eq('id', honeypot_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update honeypot'
      }, { status: 500 });
    }

    // If triggered, create anomaly event
    if (status === 'triggered' && triggered_by) {
      await getSupabase()
        .rpc('trigger_honeypot_alert', {
          p_honeypot_id: honeypot_id,
          p_triggered_by: triggered_by,
          p_evidence: evidence || { type: 'manual_trigger' }
        });
    }

    return NextResponse.json({
      success: true,
      honeypot: data,
      message: `Honeypot ${status}`
    });

  } catch (error) {
    console.error('Honeypot update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update honeypot'
    }, { status: 500 });
  }
}
