/**
 * TAP Leaderboard API
 * GET /api/tap/leaderboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create client lazily to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const tier = searchParams.get('tier');

    const supabase = getSupabase();
    
    let query = supabase
      .from('tap_scores')
      .select('*')
      .order('tap_score', { ascending: false })
      .limit(limit);

    if (tier) {
      query = query.eq('tier', tier);
    }

    const { data, error } = await query;

    if (error) throw error;

    const leaders = (data || []).map((s, index) => ({
      rank: index + 1,
      clawId: s.claw_id,
      name: s.name || s.claw_id.slice(0, 8),
      tapScore: s.tap_score,
      tier: s.tier,
      jobsCompleted: s.jobs_completed,
      disputesWon: s.disputes_won,
      committeeParticipations: s.committee_participations,
    }));

    return NextResponse.json({
      success: true,
      count: leaders.length,
      leaders,
    });
  } catch (error: any) {
    console.error('[TAP Leaderboard] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
