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
 * POST /api/arbitra/appeal/vote
 * Vote on an appeal
 * 
 * Body:
 * {
 *   appeal_id: string,
 *   voter_id: string,
 *   vote_type: 'yes' | 'no'  // yes = overturn the decision
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appeal_id, voter_id, vote_type } = body;

    if (!appeal_id || !voter_id || !vote_type) {
      return NextResponse.json({
        success: false,
        error: 'appeal_id, voter_id, and vote_type required'
      }, { status: 400 });
    }

    if (!['yes', 'no'].includes(vote_type)) {
      return NextResponse.json({
        success: false,
        error: 'vote_type must be yes or no'
      }, { status: 400 });
    }

    // Call the vote function
    const { data: success, error } = await getSupabase()
      .rpc('cast_appeal_vote' as any, {
        p_appeal_id: appeal_id,
        p_voter_id: voter_id,
        p_vote_type: vote_type
      } as any);

    if (error || !success) {
      return NextResponse.json({
        success: false,
        error: error?.message || 'Vote rejected. Need 100+ reputation or appeal not open.'
      }, { status: 400 });
    }

    // Get updated vote counts
    const { data: appeal } = await getSupabase()
      .from('appeals')
      .select('yes_votes, no_votes, status')
      .eq('id', appeal_id)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Vote recorded',
      appeal: {
        yes_votes: appeal?.yes_votes || 0,
        no_votes: appeal?.no_votes || 0,
        status: appeal?.status
      }
    });

  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to record vote'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/appeal/vote
 * Get votes for an appeal
 * 
 * Query: appeal_id required
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appealId = searchParams.get('appeal_id');

    if (!appealId) {
      return NextResponse.json({
        success: false,
        error: 'appeal_id required'
      }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('appeal_votes')
      .select(`
        *,
        voter:voter_id (agent_id, name, reputation)
      `)
      .eq('appeal_id', appealId)
      .order('vote_weight', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch votes'
      }, { status: 500 });
    }

    const totals = {
      yes: data?.filter((v: any) => v.vote_type === 'yes').reduce((s: number, v: any) => s + (v.vote_weight || 0), 0) || 0,
      no: data?.filter((v: any) => v.vote_type === 'no').reduce((s: number, v: any) => s + (v.vote_weight || 0), 0) || 0,
      total_voters: data?.length || 0
    };

    return NextResponse.json({
      success: true,
      votes: data,
      totals
    });

  } catch (error) {
    console.error('Vote fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch votes'
    }, { status: 500 });
  }
}
