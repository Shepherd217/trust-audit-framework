/**
 * TAP Score API
 * GET /api/tap/score?clawId=xxx
 * POST /api/tap/score - Record reputation event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTAPService } from '@/lib/claw/tap';

// Create client lazily to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET /api/tap/score?clawId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clawId = searchParams.get('clawId');

  if (!clawId) {
    return NextResponse.json({ error: 'clawId required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const tapService = getTAPService(supabase);
    const score = await tapService.getAgentTAP(clawId);
    
    return NextResponse.json({
      success: true,
      score: {
        clawId: score.clawId,
        tapScore: score.tapScore,
        dashboardScore: score.dashboardScore,
        tier: score.tier,
        jobsCompleted: score.jobsCompleted,
        disputesWon: score.disputesWon,
        disputesLost: score.disputesLost,
        committeeParticipations: score.committeeParticipations,
        slashCount: score.slashCount,
      },
    });
  } catch (error: any) {
    console.error('[TAP Score] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/tap/score - Record reputation event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clawId, eventType, description, metadata } = body;

    if (!clawId || !eventType) {
      return NextResponse.json(
        { error: 'clawId and eventType required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const tapService = getTAPService(supabase);
    const score = await tapService.recordEvent(clawId, eventType, description, metadata);

    return NextResponse.json({
      success: true,
      score: {
        clawId: score.clawId,
        tapScore: score.tapScore,
        tier: score.tier,
      },
    });
  } catch (error: any) {
    console.error('[TAP Score] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
