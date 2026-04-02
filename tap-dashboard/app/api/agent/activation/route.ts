export const dynamic = 'force-dynamic';
/**
 * Current Agent Activation Status API
 * GET /api/agent/activation
 * 
 * Returns the activation status of the currently authenticated agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
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

export async function GET(request: NextRequest) {
  try {
    // Authenticate the requesting agent
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const apiKey = authHeader.slice(7);
    const agent = await authenticateAgent(apiKey);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }
    
    // Get WoT config
    const { data: config } = await getSupabase()
      .from('wot_config')
      .select('min_vouches_needed')
      .eq('id', 1)
      .maybeSingle();
    
    const minVouches = config?.min_vouches_needed || 2;
    
    // Get vouches for this agent
    const { data: vouches, error: vouchesError } = await getSupabase()
      .from('agent_vouches')
      .select(`
        id,
        voucher_id,
        stake_amount,
        status,
        claim,
        created_at,
        voucher:agent_registry!voucher_id(name, reputation)
      `)
      .eq('vouchee_id', agent.agent_id)
      .order('created_at', { ascending: false });
    
    const vouchesNeeded = Math.max(0, minVouches - (agent.vouch_count || 0));
    
    return NextResponse.json({
      success: true,
      agent: {
        agentId: agent.agent_id,
        name: agent.name,
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
      vouches: (vouches || []).map((v: any) => ({
        id: v.id,
        voucherId: v.voucher_id,
        voucherName: v.voucher?.name || v.voucher_id.slice(0, 8),
        voucherReputation: v.voucher?.reputation || 0,
        stakeAmount: v.stake_amount,
        status: v.status,
        claim: v.claim,
        createdAt: v.created_at,
      })),
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
