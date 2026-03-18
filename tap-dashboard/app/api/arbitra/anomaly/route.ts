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
 * POST /api/arbitra/anomaly
 * Report or create an anomaly event
 * 
 * Body:
 * {
 *   agent_id: string,
 *   anomaly_type: string,
 *   severity: 'low' | 'medium' | 'high' | 'critical',
 *   detection_data: object,
 *   related_vouches?: string[],
 *   related_attestations?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      agent_id, 
      anomaly_type, 
      severity = 'medium',
      detection_data = {},
      related_vouches = [],
      related_attestations = []
    } = body;

    if (!agent_id || !anomaly_type) {
      return NextResponse.json({
        success: false,
        error: 'agent_id and anomaly_type are required'
      }, { status: 400 });
    }

    const { data: anomaly, error } = await getSupabase()
      .from('anomaly_events')
      .insert([{
        agent_id,
        anomaly_type,
        severity,
        detection_data,
        related_vouches,
        related_attestations,
        status: 'open'
      }])
      .select()
      .single();

    if (error) {
      console.error('Anomaly creation error:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create anomaly event'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      anomaly_id: anomaly.id,
      message: 'Anomaly event recorded'
    });

  } catch (error) {
    console.error('Anomaly API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process anomaly'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/anomaly
 * Get anomaly events with filtering
 * 
 * Query params:
 *   agent_id: string (optional)
 *   severity: string (optional)
 *   status: string (optional)
 *   anomaly_type: string (optional)
 *   limit: number (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const anomalyType = searchParams.get('anomaly_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const dashboard = searchParams.get('dashboard') === 'true';

    if (dashboard) {
      // Use the dashboard view
      const { data, error } = await getSupabase()
        .from('v_anomaly_dashboard')
        .select('*')
        .limit(limit);

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch dashboard'
        }, { status: 500 });
      }

      // Calculate summary stats
      const stats = {
        critical: data?.filter(a => a.severity === 'critical').length || 0,
        high: data?.filter(a => a.severity === 'high').length || 0,
        medium: data?.filter(a => a.severity === 'medium').length || 0,
        low: data?.filter(a => a.severity === 'low').length || 0,
        total_open: data?.length || 0
      };

      return NextResponse.json({
        success: true,
        dashboard: data,
        stats
      });
    }

    let query = getSupabase()
      .from('anomaly_events')
      .select(`
        *,
        agent:agent_id (agent_id, name, reputation, activation_status)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agentId) query = query.eq('agent_id', agentId);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (anomalyType) query = query.eq('anomaly_type', anomalyType);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch anomalies'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      anomalies: data,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Anomaly fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch anomalies'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/arbitra/anomaly
 * Update anomaly status or assign investigator
 * 
 * Body:
 * {
 *   anomaly_id: string,
 *   status?: string,
 *   assigned_to?: string,
 *   investigation_notes?: string,
 *   resolution_type?: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      anomaly_id, 
      status, 
      assigned_to, 
      investigation_notes,
      resolution_type 
    } = body;

    if (!anomaly_id) {
      return NextResponse.json({
        success: false,
        error: 'anomaly_id is required'
      }, { status: 400 });
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (assigned_to) updates.assigned_to = assigned_to;
    if (investigation_notes) updates.investigation_notes = investigation_notes;
    if (resolution_type) {
      updates.resolution_type = resolution_type;
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await getSupabase()
      .from('anomaly_events')
      .update(updates)
      .eq('id', anomaly_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update anomaly'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      anomaly: data,
      message: 'Anomaly updated'
    });

  } catch (error) {
    console.error('Anomaly update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update anomaly'
    }, { status: 500 });
  }
}
