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
 * GET /api/arbitra/honeypot/detect
 * Get honeypot detection statistics and recent detections
 * 
 * Query:
 *   stats: boolean - Get overall statistics
 *   recent: boolean - Get recent detection events
 *   agent_id: string - Check specific agent for triggers
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const getStats = searchParams.get('stats') === 'true';
    const getRecent = searchParams.get('recent') === 'true';
    const agentId = searchParams.get('agent_id');

    // Get overall stats
    if (getStats || (!getStats && !getRecent && !agentId)) {
      const { data: stats } = await getSupabase()
        .rpc('get_honeypot_stats' as any);

      return NextResponse.json({
        success: true,
        stats: stats || {},
        message: 'Honeypot detection system active'
      });
    }

    // Get recent detection events
    if (getRecent) {
      const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
      
      const { data, error } = await getSupabase()
        .from('honeypot_detection_events')
        .select(`
          *,
          honeypot:honeypot_id (name, bait_type, fake_reputation),
          agent:triggered_by (agent_id, name, reputation)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch detection events'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        detections: data,
        count: data?.length || 0
      });
    }

    // Check specific agent
    if (agentId) {
      // Get agent's detection history
      const { data: detections, error: detError } = await getSupabase()
        .from('honeypot_detection_events')
        .select(`
          *,
          honeypot:honeypot_id (name, bait_type)
        `)
        .eq('triggered_by', agentId)
        .order('created_at', { ascending: false });

      if (detError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch agent detection history'
        }, { status: 500 });
      }

      // Get recent attestations to check patterns
      const { data: attestations } = await getSupabase()
        .from('attestations')
        .select('created_at, claim')
        .eq('attester_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate rapid attestation risk
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = attestations?.filter(
        (a: any) => new Date(a.created_at) > oneHourAgo
      ).length || 0;

      return NextResponse.json({
        success: true,
        agent_id: agentId,
        risk_assessment: {
          detection_count: detections?.length || 0,
          recent_attestations_1h: recentCount,
          rapid_attestation_risk: recentCount >= 10 ? 'high' : recentCount >= 5 ? 'medium' : 'low'
        },
        detection_history: detections || []
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Specify stats, recent, or agent_id'
    }, { status: 400 });

  } catch (error) {
    console.error('Honeypot detection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch honeypot detection data'
    }, { status: 500 });
  }
}

/**
 * POST /api/arbitra/honeypot/detect
 * Manually trigger honeypot detection check
 * 
 * Body:
 * {
 *   agent_id: string,
 *   honeypot_id?: string,  -- specific honeypot to check against
 *   check_types?: string[] -- which detection rules to run
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, honeypot_id, check_types = ['all'] } = body;

    if (!agent_id) {
      return NextResponse.json({
        success: false,
        error: 'agent_id required'
      }, { status: 400 });
    }

    // Run detection check
    const { data: result, error } = await getSupabase()
      .rpc('check_honeypot_triggers' as any, {
        p_triggering_agent: agent_id,
        p_honeypot_id: honeypot_id,
        p_action_type: 'manual_check'
      } as any);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      check_result: result,
      agent_id,
      honeypot_id: honeypot_id || 'all_active',
      checked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual detection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to run detection check'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/arbitra/honeypot/detect
 * Mark detection as false positive or add review notes
 * 
 * Body:
 * {
 *   detection_id: string,
 *   false_positive: boolean,
 *   reviewer_id: string,
 *   notes?: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { detection_id, false_positive, reviewer_id, notes } = body;

    if (!detection_id || false_positive === undefined || !reviewer_id) {
      return NextResponse.json({
        success: false,
        error: 'detection_id, false_positive, and reviewer_id required'
      }, { status: 400 });
    }

    // Verify reviewer authorization
    const { data: reviewer } = await getSupabase()
      .from('agent_registry')
      .select('reputation, is_genesis')
      .eq('agent_id', reviewer_id)
      .single();

    if (!reviewer || (!reviewer.is_genesis && reviewer.reputation < 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: need genesis or 1000+ reputation'
      }, { status: 403 });
    }

    const { data, error } = await getSupabase()
      .from('honeypot_detection_events')
      .update({
        false_positive,
        reviewed_by: reviewer_id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes
      })
      .eq('id', detection_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update detection'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      detection: data,
      reviewed_by: reviewer_id,
      false_positive,
      message: false_positive 
        ? 'Marked as false positive'
        : 'Review recorded'
    });

  } catch (error) {
    console.error('Review error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to review detection'
    }, { status: 500 });
  }
}
