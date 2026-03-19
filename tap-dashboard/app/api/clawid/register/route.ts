import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Agent = Tables<'agents'>

// Rate limit: 10 registrations per minute per IP
const MAX_BODY_SIZE_KB = 50;
const MAX_PUBLIC_KEY_LENGTH = 500;
const MAX_AGENT_ID_LENGTH = 100;

export async function POST(request: NextRequest) {
  // Apply rate limiting - prevents identity spam
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/clawid/register');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const body = JSON.parse(bodyText);
    const { publicKey, agentId } = body

    if (!publicKey || !agentId) {
      const response = NextResponse.json(
        { error: 'Missing publicKey or agentId' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate input lengths
    if (typeof publicKey !== 'string' || publicKey.length > MAX_PUBLIC_KEY_LENGTH) {
      const response = NextResponse.json(
        { error: `publicKey must be a string with max ${MAX_PUBLIC_KEY_LENGTH} chars` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    if (typeof agentId !== 'string' || agentId.length > MAX_AGENT_ID_LENGTH) {
      const response = NextResponse.json(
        { error: `agentId must be a string with max ${MAX_AGENT_ID_LENGTH} chars` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', publicKey)
      .single()

    if (existing) {
      // Return existing agent
      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('public_key', publicKey)
        .single()

      if (!agent) {
        const response = NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }

      const response = NextResponse.json({
        success: true,
        agent: {
          agent_id: agent.agent_id,
          name: agent.name ?? `Agent ${agentId.slice(0, 8)}`,
          public_key: agent.public_key,
          tier: agent.tier ?? 'Bronze',
          reputation: agent.reputation ?? 0,
          status: agent.status ?? 'active',
        },
      });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Create new agent with ClawID
    const name = `Agent ${agentId.slice(0, 8)}`

    const insertData: TablesInsert<'agents'> = {
      agent_id: agentId,
      public_key: publicKey,
      boot_audit_hash: 'pending', // Required field
      name,
      tier: 'Bronze',
      reputation: 0,
      status: 'active',
    }

    const { data: agent, error } = await supabase
      .from('agents')
      .insert(insertData)
      .select()
      .single()

    if (error || !agent) {
      console.error('Failed to create agent:', error)
      const response = NextResponse.json(
        { error: 'Failed to register ClawID' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        name: agent.name ?? name,
        public_key: agent.public_key,
        tier: agent.tier ?? 'Bronze',
        reputation: agent.reputation ?? 0,
        status: agent.status ?? 'active',
      },
    });
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  } catch (error) {
    console.error('ClawID registration error:', error)
    const response = NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
