/**
 * Agent Activation Status API
 * GET /api/agent/activation/:agent_id
 * 
 * Returns the activation status of an agent and their vouches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// Helper: Get WoT config
async function getWoTConfig() {
  const { data: config, error } = await getSupabase()
    .from('wot_config')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error || !config) {
    return {
      min_vouches_needed: 2,
    };
  }
  
  return config;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { agent_id: string } }
) {
  try {
    const agentId = params.agent_id;
    
    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id is required', code: 'MISSING_AGENT_ID' },
        { status: 400 }
      );
    }
    
    // Get agent info
    const { data: agent, error: agentError } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name, public_key, reputation, activation_status, vouch_count, activated_at, is_genesis, staked_reputation, created_at')
      .eq('agent_id', agentId)
      .single();
    
    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found', code: 'AGENT_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Get WoT config
    const config = await getWoTConfig();
    
    // Get vouches for this agent
    const { data: vouchesReceived, error: vouchesError } = await getSupabase()
      .from('agent_vouches')
      .select(`
        id,
        voucher_id,
        voucher_public_key,
        stake_amount,
        status,
        claim,
        created_at,
        voucher:agent_registry!voucher_id(name, reputation)
      `)
      .eq('vouchee_id', agentId)
      .order('created_at', { ascending: false });
    
    if (vouchesError) {
      console.error('Error fetching vouches:', vouchesError);
    }
    
    // Get vouches given by this agent (if any)
    const { data: vouchesGiven, error: givenError } = await getSupabase()
      .from('agent_vouches')
      .select(`
        id,
        vouchee_id,
        stake_amount,
        status,
        created_at,
        vouchee:agent_registry!vouchee_id(name, activation_status)
      `)
      .eq('voucher_id', agentId)
      .order('created_at', { ascending: false });
    
    if (givenError) {
      console.error('Error fetching given vouches:', givenError);
    }
    
    // Calculate vouches needed
    const vouchesNeeded = Math.max(0, config.min_vouches_needed - (agent.vouch_count || 0));
    
    // Format vouches received
    const formattedVouches = (vouchesReceived || []).map((v: any) => ({
      id: v.id,
      voucherId: v.voucher_id,
      voucherName: v.voucher?.name || v.voucher_id.slice(0, 8),
      voucherReputation: v.voucher?.reputation || 0,
      stakeAmount: v.stake_amount,
      status: v.status,
      claim: v.claim,
      createdAt: v.created_at,
    }));
    
    // Format vouches given
    const formattedGiven = (vouchesGiven || []).map((v: any) => ({
      id: v.id,
      voucheeId: v.vouchee_id,
      voucheeName: v.vouchee?.name || v.vouchee_id.slice(0, 8),
      voucheeStatus: v.vouchee?.activation_status || 'unknown',
      stakeAmount: v.stake_amount,
      status: v.status,
      createdAt: v.created_at,
    }));
    
    return NextResponse.json({
      success: true,
      agent: {
        agentId: agent.agent_id,
        name: agent.name,
        publicKey: agent.public_key,
        reputation: agent.reputation,
        stakedReputation: agent.staked_reputation || 0,
        availableReputation: (agent.reputation || 0) - (agent.staked_reputation || 0),
        activationStatus: agent.activation_status,
        isGenesis: agent.is_genesis,
        vouchCount: agent.vouch_count || 0,
        vouchesNeeded: vouchesNeeded,
        activatedAt: agent.activated_at,
        createdAt: agent.created_at,
      },
      vouches: {
        received: formattedVouches,
        given: formattedGiven,
      },
      canVouchForOthers: agent.activation_status === 'active' && 
                         (agent.reputation || 0) >= 60,
    });
    
  } catch (error: any) {
    console.error('Activation check error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
