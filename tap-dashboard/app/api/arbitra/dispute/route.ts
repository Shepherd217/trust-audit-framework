import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { checkRateLimit, getClientIP, createRateLimitHeaders } from '@/lib/rate-limit';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/arbitra/dispute
 * Initiate a dispute against an agent or attestation
 * 
 * Body:
 * {
 *   target_id: string,        // Agent being accused
 *   target_type: 'agent' | 'attestation' | 'vouch',
 *   target_record_id?: string, // UUID of attestation/vouch if applicable
 *   reason: string,
 *   evidence?: string,        // CID or description
 *   reporter_id: string,      // Agent reporting
 *   bond_amount: number       // Stake for dispute (must be ≥100)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - critical endpoint (affects reputation)
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit('critical', `dispute:${clientIP}`);
    
    if (!rateLimit.success) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Try again later.'
      }, { 
        status: 429,
        headers: createRateLimitHeaders(rateLimit)
      });
    }

    const body = await request.json();
    const { 
      target_id, 
      target_type = 'agent',
      target_record_id,
      reason, 
      evidence,
      reporter_id,
      bond_amount = 100 
    } = body;

    // Validate required fields
    if (!target_id || !reason || !reporter_id) {
      return NextResponse.json({
        success: false,
        error: 'target_id, reason, and reporter_id are required'
      }, { status: 400 });
    }

    if (bond_amount < 100) {
      return NextResponse.json({
        success: false,
        error: 'Bond must be at least 100 reputation'
      }, { status: 400 });
    }

    // Get reporter's available reputation
    const { data: reporter } = await getSupabase()
      .from('agent_registry')
      .select('reputation, staked_reputation')
      .eq('agent_id', reporter_id)
      .single();

    if (!reporter) {
      return NextResponse.json({
        success: false,
        error: 'Reporter agent not found'
      }, { status: 404 });
    }

    const availableReputation = (reporter.reputation || 0) - (reporter.staked_reputation || 0);
    if (availableReputation < bond_amount) {
      return NextResponse.json({
        success: false,
        error: `Insufficient reputation. Available: ${availableReputation}, Required: ${bond_amount}`
      }, { status: 400 });
    }

    // Create dispute case
    const { data: dispute, error } = await getSupabase()
      .from('dispute_cases')
      .insert([{
        target_id,
        target_type,
        target_record_id,
        reporter_id,
        reason,
        evidence_cid: evidence,
        bond_amount,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to create dispute:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create dispute'
      }, { status: 500 });
    }

    // Lock reporter's bond
    await getSupabase()
      .from('agent_registry')
      .update({ 
        staked_reputation: (reporter.staked_reputation || 0) + bond_amount 
      })
      .eq('agent_id', reporter_id);

    return NextResponse.json({
      success: true,
      dispute_id: dispute.id,
      message: 'Dispute filed. Case will be reviewed by Arbitra.',
      bond_locked: bond_amount
    });

  } catch (error) {
    console.error('Dispute creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process dispute'
    }, { status: 500 });
  }
}

/**
 * GET /api/arbitra/dispute
 * List disputes or get specific dispute
 * 
 * Query params:
 *   dispute_id: string (optional) - get specific dispute
 *   status: string (optional) - filter by status
 *   target_id: string (optional) - filter by target
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const disputeId = searchParams.get('dispute_id');
    const status = searchParams.get('status');
    const targetId = searchParams.get('target_id');

    if (disputeId) {
      const { data, error } = await getSupabase()
        .from('dispute_cases')
        .select(`
          *,
          target:target_id (agent_id, name, reputation),
          reporter:reporter_id (agent_id, name)
        `)
        .eq('id', disputeId)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Dispute not found'
        }, { status: 404 });
      }

      return NextResponse.json({ success: true, dispute: data });
    }

    let query = getSupabase()
      .from('dispute_cases')
      .select(`
        *,
        target:target_id (agent_id, name),
        reporter:reporter_id (agent_id, name)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (targetId) query = query.eq('target_id', targetId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch disputes'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      disputes: data,
      count: data?.length || 0 
    });

  } catch (error) {
    console.error('Dispute fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch disputes'
    }, { status: 500 });
  }
}
