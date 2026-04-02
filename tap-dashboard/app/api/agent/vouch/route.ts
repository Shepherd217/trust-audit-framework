export const dynamic = 'force-dynamic';
/**
 * Vouch Submission API
 * POST /api/agent/vouch
 * 
 * Allows an active agent to vouch for a pending agent,
 * staking reputation to bootstrap them into the network.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { checkRateLimit, getClientIP, createRateLimitHeaders } from '@/lib/rate-limit';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Lazy initialization
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

// Helper: Verify API key and get agent
async function authenticateAgent(apiKey: string) {
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const { data: agent, error } = await getSupabase()
    .from('agent_registry')
    .select('*')
    .eq('api_key_hash', apiKeyHash)
    .maybeSingle();
  
  if (error || !agent) {
    return null;
  }
  
  return agent;
}

// Helper: Get WoT config
async function getWoTConfig() {
  const { data: config, error } = await getSupabase()
    .from('wot_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  
  if (error || !config) {
    // Return defaults
    return {
      min_vouch_reputation: 60,
      min_vouches_needed: 2,
      min_stake_amount: 100,
      max_stake_amount: 5000,
      initial_reputation: 100,
    };
  }
  
  return config;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - critical endpoint (affects reputation network)
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit('critical', `vouch:${clientIP}`);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimit)
        }
      );
    }

    // Authenticate the voucher
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const apiKey = authHeader.slice(7);
    const voucher = await authenticateAgent(apiKey);
    
    if (!voucher) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { target_agent_id, stake_amount = 100, claim = '' } = body;
    
    if (!target_agent_id) {
      return NextResponse.json(
        { error: 'target_agent_id is required', code: 'MISSING_TARGET' },
        { status: 400 }
      );
    }
    
    // Get WoT configuration
    const config = await getWoTConfig();
    
    // Validate voucher requirements
    if (voucher.activation_status !== 'active') {
      return NextResponse.json(
        { 
          error: 'Only active agents can vouch for others', 
          code: 'VOUCHER_NOT_ACTIVE',
          yourStatus: voucher.activation_status
        },
        { status: 403 }
      );
    }
    
    if (voucher.reputation < config.min_vouch_reputation) {
      return NextResponse.json(
        { 
          error: `Minimum reputation to vouch is ${config.min_vouch_reputation}`, 
          code: 'INSUFFICIENT_REPUTATION',
          yourReputation: voucher.reputation,
          required: config.min_vouch_reputation
        },
        { status: 403 }
      );
    }
    
    // Calculate available reputation (not staked)
    const stakedReputation = voucher.staked_reputation || 0;
    const availableReputation = voucher.reputation - stakedReputation;
    
    // Validate stake amount
    const requestedStake = parseInt(stake_amount) || config.min_stake_amount;
    
    if (requestedStake < config.min_stake_amount) {
      return NextResponse.json(
        { 
          error: `Minimum stake is ${config.min_stake_amount}`, 
          code: 'STAKE_TOO_LOW',
          minimum: config.min_stake_amount
        },
        { status: 400 }
      );
    }
    
    if (requestedStake > config.max_stake_amount) {
      return NextResponse.json(
        { 
          error: `Maximum stake is ${config.max_stake_amount}`, 
          code: 'STAKE_TOO_HIGH',
          maximum: config.max_stake_amount
        },
        { status: 400 }
      );
    }
    
    if (requestedStake > availableReputation) {
      return NextResponse.json(
        { 
          error: 'Insufficient unstaked reputation', 
          code: 'INSUFFICIENT_STAKE',
          available: availableReputation,
          requested: requestedStake
        },
        { status: 400 }
      );
    }
    
    // Get target agent
    const { data: vouchee, error: voucheeError } = await getSupabase()
      .from('agent_registry')
      .select('*')
      .eq('agent_id', target_agent_id)
      .maybeSingle();
    
    if (voucheeError || !vouchee) {
      return NextResponse.json(
        { error: 'Target agent not found', code: 'TARGET_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Prevent self-vouching
    if (voucher.agent_id === target_agent_id) {
      return NextResponse.json(
        { error: 'Cannot vouch for yourself', code: 'SELF_VOUCH' },
        { status: 400 }
      );
    }

    // ── Sybil Protection ──────────────────────────────────────────────────────
    // Vouching requires a completed marketplace contract between the two agents.
    // Genesis agents (registered with x-genesis-token) are exempt — they ARE the bootstrap.
    // We use agent_registry.is_genesis (set at registration) NOT the legacy agents table,
    // which could be populated by migrations and silently widen the bypass.
    const isVoucherGenesis = voucher.is_genesis === true;

    if (!isVoucherGenesis) {
      const { data: sharedContract } = await getSupabase()
        .from('marketplace_contracts')
        .select('id')
        .or(
          `and(hirer_id.eq.${voucher.agent_id},worker_id.eq.${target_agent_id}),` +
          `and(hirer_id.eq.${target_agent_id},worker_id.eq.${voucher.agent_id})`
        )
        .limit(1)

      if (!sharedContract || sharedContract.length === 0) {
        return NextResponse.json(
          {
            error: 'Vouching requires a completed marketplace job between both agents. Complete paid work together first.',
            code: 'NO_SHARED_JOB',
            detail: `No contract found between ${voucher.agent_id} and ${target_agent_id}`,
          },
          { status: 403 }
        )
      }
    }
    // ── End Sybil Protection ──────────────────────────────────────────────────

    // Check if already vouched
    const { data: existingVouch, error: existingError } = await getSupabase()
      .from('agent_vouches')
      .select('*')
      .eq('voucher_id', voucher.agent_id)
      .eq('vouchee_id', target_agent_id)
      .maybeSingle();
    
    if (existingVouch) {
      return NextResponse.json(
        { 
          error: 'You have already vouched for this agent', 
          code: 'ALREADY_VOUChed',
          vouchStatus: existingVouch.status
        },
        { status: 409 }
      );
    }
    
    // Create signature (simplified - in production would use proper crypto)
    const signatureData = `${voucher.agent_id}:${target_agent_id}:${requestedStake}:${Date.now()}`;
    const signature = createHash('sha256').update(signatureData).digest('hex');
    
    // Create the vouch record
    const { data: vouch, error: vouchError } = await getSupabase()
      .from('agent_vouches')
      .insert({
        voucher_id: voucher.agent_id,
        voucher_public_key: voucher.public_key,
        vouchee_id: target_agent_id,
        vouchee_public_key: vouchee.public_key,
        stake_amount: requestedStake,
        status: 'active',
        claim: claim.slice(0, 500), // Limit claim length
        voucher_signature: signature,
      })
      .select()
      .maybeSingle();
    
    if (vouchError) {
      console.error('Vouch creation error:', vouchError);
      return NextResponse.json(
        { error: 'Failed to create vouch', code: 'DB_ERROR' },
        { status: 500 }
      );
    }
    
    // Update staked reputation for voucher
    const newStakedAmount = stakedReputation + requestedStake;
    await getSupabase()
      .from('agent_registry')
      .update({ staked_reputation: newStakedAmount })
      .eq('agent_id', voucher.agent_id);
    
    // Check if vouchee should be activated (the trigger will handle this, but let's get the updated status)
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for trigger
    
    const { data: updatedVouchee } = await getSupabase()
      .from('agent_registry')
      .select('activation_status, vouch_count, reputation, activated_at')
      .eq('agent_id', target_agent_id)
      .maybeSingle();
    
    // Return success response
    const wasActivated = updatedVouchee?.activation_status === 'active' && 
                         vouchee.activation_status === 'pending';
    
    return NextResponse.json({
      success: true,
      vouch: {
        id: vouch.id,
        voucherId: voucher.agent_id,
        voucheeId: target_agent_id,
        stakeAmount: requestedStake,
        status: 'active',
        createdAt: vouch.created_at,
      },
      vouchee: {
        agentId: target_agent_id,
        previousStatus: vouchee.activation_status,
        currentStatus: updatedVouchee?.activation_status || vouchee.activation_status,
        vouchCount: updatedVouchee?.vouch_count || (vouchee.vouch_count + 1),
        reputation: updatedVouchee?.reputation || vouchee.reputation,
        activatedAt: updatedVouchee?.activated_at,
      },
      voucher: {
        agentId: voucher.agent_id,
        stakedReputation: newStakedAmount,
        availableReputation: voucher.reputation - newStakedAmount,
      },
      message: wasActivated 
        ? `✅ Agent activated! ${target_agent_id} now has access to the network.`
        : `✅ Vouch recorded. Agent needs ${config.min_vouches_needed - (updatedVouchee?.vouch_count || 1)} more vouch(es) to activate.`,
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Vouch error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// GET /api/agent/vouch - Get vouch information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voucheeId = searchParams.get('for');
    const voucherId = searchParams.get('by');
    
    let query = getSupabase()
      .from('agent_vouches')
      .select(`
        *,
        voucher:agent_registry!voucher_id(name, reputation),
        vouchee:agent_registry!vouchee_id(name, activation_status)
      `);
    
    if (voucheeId) {
      query = query.eq('vouchee_id', voucheeId);
    }
    
    if (voucherId) {
      query = query.eq('voucher_id', voucherId);
    }
    
    const { data: vouches, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch vouches', code: 'DB_ERROR' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      vouches: vouches || [],
      count: vouches?.length || 0,
    });
    
  } catch (error: any) {
    console.error('Vouch fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
