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
 * POST /api/arbitra/scan
 * Run automated anomaly detection scans
 * 
 * Body (optional):
 * {
 *   scan_type?: 'all' | 'rapid_attestation' | 'collusion' | 'honeypot',
 *   agent_id?: string -- scan specific agent
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { scan_type = 'all', agent_id } = body;

    const results = {
      rapid_attestation: [],
      collusion: [],
      honeypot_triggers: [],
      total_found: 0
    };

    // 1. Scan for rapid attestation pattern
    if (scan_type === 'all' || scan_type === 'rapid_attestation') {
      const { data: rapidAttesters } = await getSupabase()
        .rpc('find_rapid_attesters', { 
          p_window_hours: 1, 
          p_threshold: 5 
        });

      if (rapidAttesters) {
        for (const agent of rapidAttesters) {
          if (agent_id && agent.agent_id !== agent_id) continue;
          
          // Create anomaly event
          const { data: anomaly } = await getSupabase()
            .from('anomaly_events')
            .insert([{
              agent_id: agent.agent_id,
              anomaly_type: 'rapid_attestation',
              severity: agent.vouch_count > 10 ? 'high' : 'medium',
              detection_data: {
                vouches_in_window: agent.vouch_count,
                window_hours: 1,
                threshold: 5,
                confidence: Math.min(agent.vouch_count / 10, 1.0)
              },
              status: 'open'
            }])
            .select()
            .single();

          results.rapid_attestation.push({
            agent_id: agent.agent_id,
            vouch_count: agent.vouch_count,
            anomaly_id: anomaly?.id
          });
        }
      }
    }

    // 2. Scan for collusion patterns
    if (scan_type === 'all' || scan_type === 'collusion') {
      // Get active agents
      const { data: agents } = await getSupabase()
        .from('agent_registry')
        .select('agent_id')
        .eq('activation_status', 'active')
        .limit(100);

      if (agents) {
        for (const agent of agents) {
          if (agent_id && agent.agent_id !== agent_id) continue;

          const { data: collusionData } = await getSupabase()
            .rpc('detect_collusion_ring', { 
              p_agent_id: agent.agent_id, 
              p_depth: 3 
            });

          if (collusionData && collusionData.length > 0) {
            const ringAgents = [...new Set(collusionData.map((c: any) => c.ring_agent_id))];
            
            const { data: anomaly } = await getSupabase()
              .from('anomaly_events')
              .insert([{
                agent_id: agent.agent_id,
                anomaly_type: 'collusion_detected',
                severity: 'critical',
                detection_data: {
                  ring_size: ringAgents.length,
                  ring_agents: ringAgents,
                  cycle_detected: collusionData.some((c: any) => c.cycle_detected),
                  confidence: 0.9
                },
                status: 'open'
              }])
              .select()
              .single();

            results.collusion.push({
              agent_id: agent.agent_id,
              ring_agents: ringAgents,
              anomaly_id: anomaly?.id
            });
          }
        }
      }
    }

    // 3. Check honeypot triggers
    if (scan_type === 'all' || scan_type === 'honeypot') {
      const { data: triggeredHoneypots } = await getSupabase()
        .from('honeypot_agents')
        .select('*')
        .eq('status', 'triggered')
        .gt('triggered_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h

      if (triggeredHoneypots) {
        results.honeypot_triggers = triggeredHoneypots.map(h => ({
          honeypot_id: h.id,
          honeypot_name: h.name,
          triggered_by: h.triggered_by,
          bait_type: h.bait_type
        }));
      }
    }

    results.total_found = results.rapid_attestation.length + 
                         results.collusion.length + 
                         results.honeypot_triggers.length;

    return NextResponse.json({
      success: true,
      scan_type,
      results,
      message: results.total_found > 0 
        ? `Found ${results.total_found} anomalies`
        : 'No anomalies detected'
    });

  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({
      success: false,
      error: 'Scan failed'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/scan
 * Get scan statistics and recent findings
 */
export async function GET(request: NextRequest) {
  try {
    // Get counts by type
    const { data: byType } = await getSupabase()
      .from('anomaly_events')
      .select('anomaly_type, severity, count')
      .eq('status', 'open')
      .order('count', { ascending: false });

    // Get 24h trend
    const { data: last24h } = await getSupabase()
      .from('anomaly_events')
      .select('created_at, severity')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const stats = {
      total_open: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      by_type: {} as Record<string, number>,
      last_24h: last24h?.length || 0
    };

    for (const event of (byType || [])) {
      stats.total_open += event.count;
      stats.by_severity[event.severity as keyof typeof stats.by_severity] += event.count;
      stats.by_type[event.anomaly_type] = (stats.by_type[event.anomaly_type] || 0) + event.count;
    }

    return NextResponse.json({
      success: true,
      stats,
      message: `${stats.total_open} open anomalies, ${stats.last_24h} in last 24h`
    });

  } catch (error) {
    console.error('Scan stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get scan stats'
    }, { status: 500 });
  }
}
