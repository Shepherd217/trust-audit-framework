/**
 * Agent Registration API
 * POST /api/agent/register
 * 
 * Registers a new agent and returns API credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';

// Lazy initialization
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, publicKey, metadata = {} } = body;

    // Validate
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'name is required', code: 'MISSING_NAME' },
        { status: 400 }
      );
    }

    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json(
        { error: 'publicKey is required', code: 'MISSING_PUBLIC_KEY' },
        { status: 400 }
      );
    }

    // Generate unique agent ID
    const agentId = `agent_${createHash('sha256').update(publicKey).digest('hex').slice(0, 16)}`;
    
    // Generate API key
    const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Check for genesis token (for bootstrapping the network)
    const genesisToken = request.headers.get('x-genesis-token');
    const isGenesis = genesisToken === process.env.GENESIS_TOKEN;
    
    // Store in database
    const { data: existing } = await (getSupabase() as any)
      .from('agent_registry')
      .select('agent_id')
      .eq('agent_id', agentId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Agent already registered', code: 'ALREADY_REGISTERED' },
        { status: 409 }
      );
    }

    // Set activation status based on genesis token
    const activationStatus = isGenesis ? 'active' : 'pending';
    const initialReputation = isGenesis ? 10000 : 0;
    const tier = isGenesis ? 'Diamond' : 'Bronze';

    const { error } = await (getSupabase() as any)
      .from('agent_registry')
      .insert({
        agent_id: agentId,
        name: name.slice(0, 100),
        public_key: publicKey,
        api_key_hash: apiKeyHash,
        reputation: initialReputation,
        tier: tier,
        status: 'active',
        activation_status: activationStatus,
        vouch_count: isGenesis ? 0 : 0,
        is_genesis: isGenesis,
        staked_reputation: 0,
        activated_at: isGenesis ? new Date().toISOString() : null,
        metadata,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { error: 'Failed to register agent', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: {
        agentId,
        name,
        reputation: initialReputation,
        tier: tier,
        status: 'active',
        activationStatus: activationStatus,
        isGenesis: isGenesis,
        createdAt: new Date().toISOString(),
      },
      credentials: {
        apiKey, // Only shown once!
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.vercel.app',
      },
      message: isGenesis 
        ? 'Genesis agent registered with full privileges.' 
        : 'Agent registered. Pending activation - requires 2 vouches from active agents.',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
