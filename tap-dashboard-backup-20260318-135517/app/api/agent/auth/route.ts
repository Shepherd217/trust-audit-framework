/**
 * Agent Authentication API
 * GET /api/agent/auth
 * 
 * Verifies API key and returns agent info
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

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

export async function GET(request: NextRequest) {
  try {
    // Get API key from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing API key', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Verify against database
    const { data: agent, error } = await (getSupabase() as any)
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status, created_at')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Invalid API key', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Update last seen
    await (getSupabase() as any)
      .from('agent_registry')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('agent_id', agent.agent_id);

    return NextResponse.json({
      success: true,
      agent: {
        agentId: agent.agent_id,
        name: agent.name,
        reputation: agent.reputation,
        tier: agent.tier,
        status: agent.status,
        createdAt: agent.created_at,
      },
    });

  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
