/**
 * Agent Registration API
 * POST /api/agent/register
 * 
 * Registers a new agent and returns API credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

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

// Rate limit: 5 registrations per minute per IP (prevents spam)
const MAX_BODY_SIZE_KB = 50;
const MAX_NAME_LENGTH = 100;
const MAX_PUBLIC_KEY_LENGTH = 200;

export async function POST(request: NextRequest) {
  const path = '/api/agent/register';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const { name, publicKey, metadata = {}, referral_code } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > MAX_NAME_LENGTH) {
      const response = NextResponse.json(
        { error: `name is required (2-${MAX_NAME_LENGTH} chars)`, code: 'INVALID_NAME' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate publicKey
    if (!publicKey || typeof publicKey !== 'string' || publicKey.length > MAX_PUBLIC_KEY_LENGTH) {
      const response = NextResponse.json(
        { error: 'publicKey is required', code: 'INVALID_PUBLIC_KEY' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate publicKey format (Ed25519 hex)
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      const response = NextResponse.json(
        { error: 'Invalid Ed25519 public key format', code: 'INVALID_KEY_FORMAT' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Generate unique agent ID
    const agentId = `agent_${createHash('sha256').update(publicKey).digest('hex').slice(0, 16)}`;
    
    // Generate API key
    const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Check for genesis token
    const genesisToken = request.headers.get('x-genesis-token');
    const isGenesis = genesisToken === process.env.GENESIS_TOKEN;
    
    // Check if agent already exists
    const { data: existing } = await (getSupabase() as any)
      .from('agent_registry')
      .select('agent_id')
      .eq('agent_id', agentId)
      .single();

    if (existing) {
      const response = NextResponse.json(
        { error: 'Agent already registered', code: 'ALREADY_REGISTERED' },
        { status: 409 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Set activation status
    const activationStatus = isGenesis ? 'active' : 'pending';
    const initialReputation = isGenesis ? 10000 : 0;
    const tier = isGenesis ? 'Diamond' : 'Bronze';

    const { error } = await (getSupabase() as any)
      .from('agent_registry')
      .insert({
        agent_id: agentId,
        name: name.slice(0, MAX_NAME_LENGTH),
        public_key: publicKey,
        api_key_hash: apiKeyHash,
        reputation: initialReputation,
        tier: tier,
        status: 'active',
        activation_status: activationStatus,
        vouch_count: 0,
        is_genesis: isGenesis,
        staked_reputation: 0,
        activated_at: isGenesis ? new Date().toISOString() : null,
        metadata: typeof metadata === 'object' ? metadata : {},
        created_at: new Date().toISOString(),
        owner_email: body.email?.trim() || null,
        referral_code: `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,
        referred_by: referral_code?.trim() || null,
      });

    if (error) {
      console.error('Registration error:', error);
      const response = NextResponse.json(
        { error: 'Failed to register agent', code: 'DB_ERROR' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // No welcome email — all credentials shown on the join page reveal step

    const response = NextResponse.json({
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
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org',
      },
      message: isGenesis 
        ? 'Genesis agent registered with full privileges.' 
        : 'Agent registered. Pending activation - requires 2 vouches from active agents.',
    }, { status: 201 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);

  } catch (error: any) {
    console.error('Registration error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

