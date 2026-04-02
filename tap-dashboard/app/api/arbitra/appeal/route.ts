export const dynamic = 'force-dynamic';
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
 * POST /api/arbitra/appeal
 * File an appeal against a slash or dispute resolution
 * 
 * Body:
 * {
 *   dispute_id?: string,
 *   slash_event_id?: string,
 *   appellant_id: string,
 *   grounds: string,
 *   new_evidence?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      dispute_id, 
      slash_event_id, 
      appellant_id, 
      grounds, 
      new_evidence 
    } = body;

    if (!appellant_id || !grounds || (!dispute_id && !slash_event_id)) {
      return NextResponse.json({
        success: false,
        error: 'appellant_id, grounds, and (dispute_id or slash_event_id) required'
      }, { status: 400 });
    }

    // Get config for appeal bond
    const { data: config } = await getSupabase()
      .from('wot_config')
      .select('appeal_bond_amount, appeal_window_days')
      .eq('id', 1)
      .maybeSingle();

    const appealBond = config?.appeal_bond_amount || 200;
    const appealWindowDays = config?.appeal_window_days || 7;

    // Check appellant has available reputation
    const { data: appellant } = await getSupabase()
      .from('agent_registry')
      .select('reputation, staked_reputation')
      .eq('agent_id', appellant_id)
      .maybeSingle();

    if (!appellant) {
      return NextResponse.json({
        success: false,
        error: 'Appellant not found'
      }, { status: 404 });
    }

    const available = (appellant.reputation || 0) - (appellant.staked_reputation || 0);
    if (available < appealBond) {
      return NextResponse.json({
        success: false,
        error: `Need ${appealBond} available reputation. Have: ${available}`
      }, { status: 400 });
    }

    // Check not past appeal window
    let originalDate: Date | null = null;
    if (dispute_id) {
      const { data: dispute } = await getSupabase()
        .from('dispute_cases')
        .select('resolved_at')
        .eq('id', dispute_id)
        .maybeSingle();
      if (dispute?.resolved_at) originalDate = new Date(dispute.resolved_at);
    } else if (slash_event_id) {
      const { data: slash } = await getSupabase()
        .from('slash_events')
        .select('created_at')
        .eq('id', slash_event_id)
        .maybeSingle();
      if (slash?.created_at) originalDate = new Date(slash.created_at);
    }

    if (originalDate) {
      const windowCloses = new Date(originalDate);
      windowCloses.setDate(windowCloses.getDate() + appealWindowDays);
      
      if (new Date() > windowCloses) {
        return NextResponse.json({
          success: false,
          error: 'Appeal window has closed'
        }, { status: 400 });
      }
    }

    // Lock the bond
    await getSupabase()
      .from('agent_registry')
      .update({ staked_reputation: (appellant.staked_reputation || 0) + appealBond })
      .eq('agent_id', appellant_id);

    // Create appeal
    const { data: appeal, error } = await getSupabase()
      .from('appeals')
      .insert([{
        dispute_id,
        slash_event_id,
        appellant_id,
        grounds,
        new_evidence,
        appeal_bond: appealBond,
        appeal_window_closes: originalDate 
          ? new Date(originalDate.getTime() + appealWindowDays * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + appealWindowDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }])
      .select()
      .maybeSingle();

    if (error) {
      // Refund bond on error
      await getSupabase()
        .from('agent_registry')
        .update({ staked_reputation: appellant.staked_reputation })
        .eq('agent_id', appellant_id);
      
      throw error;
    }

    return NextResponse.json({
      success: true,
      appeal_id: appeal.id,
      bond_locked: appealBond,
      message: 'Appeal filed. Voting will begin once reviewed.'
    });

  } catch (error) {
    console.error('Appeal error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to file appeal'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/appeal
 * Get appeals
 * 
 * Query:
 *   appeal_id: specific appeal
 *   appellant_id: filter by appellant
 *   status: filter by status
 *   voting: boolean - only open for voting
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appealId = searchParams.get('appeal_id');
    const appellantId = searchParams.get('appellant_id');
    const status = searchParams.get('status');
    const voting = searchParams.get('voting') === 'true';

    if (appealId) {
      const { data, error } = await getSupabase()
        .from('appeals')
        .select(`
          *,
          appellant:appellant_id (agent_id, name, reputation),
          dispute:dispute_id (*),
          votes:appeal_votes (voter_id, vote_type, vote_weight)
        `)
        .eq('id', appealId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Appeal not found'
        }, { status: 404 });
      }

      return NextResponse.json({ success: true, appeal: data });
    }

    let query = getSupabase()
      .from('appeals')
      .select(`
        *,
        appellant:appellant_id (agent_id, name)
      `)
      .order('filed_at', { ascending: false });

    if (appellantId) query = query.eq('appellant_id', appellantId);
    if (status) query = query.eq('status', status);
    if (voting) query = query.eq('status', 'voting');

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch appeals'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      appeals: data,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Appeal fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch appeals'
    }, { status: 500 });
  }
}
