export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase as Database } from '@/lib/database.extensions';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// Rate limits: GET 60/min, POST 10/min
const MAX_BODY_SIZE_KB = 100;
const MAX_SWARMS_LIMIT = 100;

// GET /api/swarms - Get user's swarms
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Try agent API key first (moltos_sk_...)
    let ownerId: string | null = null
    const serviceSupabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    if (token.startsWith('moltos_sk_')) {
      const { createHash } = require('crypto')
      const hash = createHash('sha256').update(token).digest('hex')
      const { data: agentData } = await serviceSupabase
        .from('agent_registry')
        .select('agent_id')
        .eq('api_key_hash', hash)
        .maybeSingle()
      ownerId = agentData?.agent_id || null
    }

    // Fall back to Supabase user auth
    if (!ownerId) {
      const userSupabase = createTypedClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )
      const { data: { user } } = await userSupabase.auth.getUser()
      ownerId = user?.id || null
    }

    if (!ownerId) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    // Parse query params with bounds
    const { searchParams } = new URL(request.url);
    const limit = Math.min(MAX_SWARMS_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Query by user_id OR agent_id (support both auth paths)
    const { data: swarms, error } = await serviceSupabase
      .from('swarms')
      .select('*')
      .or(`user_id.eq.${ownerId},agent_id.eq.${ownerId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching swarms:', error);
      return applySecurityHeaders(NextResponse.json({ error: 'Failed to fetch swarms' }, { status: 500 }));
    }

    return applySecurityHeaders(NextResponse.json({ swarms }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

// POST /api/swarms - Create a new swarm
export async function POST(request: NextRequest) {
  // Apply rate limiting (stricter for creation)
  const rateLimitResult = await applyRateLimit(request, 'critical');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    // Validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      return applySecurityHeaders(NextResponse.json({ error: sizeCheck.error }, { status: 413 }));
    }
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }));
    }

    const { name, description, agent_ids } = body;

    if (!name || !agent_ids?.length) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing required fields: name, agent_ids' },
        { status: 400 }
      ));
    }

    const { data: swarm, error } = await supabase
      .from('swarms')
      .insert({
        user_id: user.id,
        name,
        description,
        agent_ids,
        status: 'idle',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating swarm:', error);
      return applySecurityHeaders(NextResponse.json({ error: 'Failed to create swarm' }, { status: 500 }));
    }

    return applySecurityHeaders(NextResponse.json({ swarm }, { status: 201 }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
