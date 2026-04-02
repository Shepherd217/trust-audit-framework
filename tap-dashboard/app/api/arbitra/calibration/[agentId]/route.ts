export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

/**
 * GET /api/arbitra/calibration/[agentId]
 * Get calibration metrics for an agent
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agentId = params.agentId;
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') as any;
    const lookbackDays = parseInt(searchParams.get('days') || '90');
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get calibration from RPC
    const { data: calibration, error } = await supabase.rpc('calculate_calibration', {
      p_agent_id: agentId,
      p_domain: domain || 'software',
      p_lookback_days: lookbackDays
    } as any);
    
    if (error) throw error;
    
    // Get expertise profile
    const { data: profile } = await supabase
      .from('committee_expertise_profiles')
      .select('*')
      .eq('agent_id', agentId)
      .eq('domain', domain || 'software')
      .maybeSingle();
    
    // Get recent history for calibration curve
    const { data: history } = await supabase
      .from('expertise_history')
      .select('confidence_reported, was_correct, created_at')
      .eq('agent_id', agentId)
      .eq('domain', domain || 'software')
      .gte('created_at', new Date(Date.now() - lookbackDays * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    
    // Build calibration curve (5 bins)
    const bins = [
      { bin: '0-20%', min: 0, max: 0.2, predicted: 0.1, actual: 0, count: 0 },
      { bin: '20-40%', min: 0.2, max: 0.4, predicted: 0.3, actual: 0, count: 0 },
      { bin: '40-60%', min: 0.4, max: 0.6, predicted: 0.5, actual: 0, count: 0 },
      { bin: '60-80%', min: 0.6, max: 0.8, predicted: 0.7, actual: 0, count: 0 },
      { bin: '80-100%', min: 0.8, max: 1.0, predicted: 0.9, actual: 0, count: 0 }
    ];
    
    if (history) {
      for (const entry of history) {
        const bin = bins.find(b => 
          entry.confidence_reported >= b.min && entry.confidence_reported < b.max
        );
        if (bin) {
          bin.count++;
          if (entry.was_correct) {
            bin.actual += 1;
          }
        }
      }
      
      // Normalize actual rates
      for (const bin of bins) {
        if (bin.count > 0) {
          bin.actual = bin.actual / bin.count;
        }
      }
    }
    
    return NextResponse.json({
      agent_id: agentId,
      domain: domain || 'software',
      lookback_days: lookbackDays,
      calibration: calibration?.[0] || null,
      profile: profile || null,
      calibration_curve: bins,
      sample_size: history?.length || 0,
      last_updated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Calibration] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calibration' },
      { status: 500 }
    );
  }
}
