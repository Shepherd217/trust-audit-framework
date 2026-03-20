import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// Rate limits: GET 60/min (list), POST 10/min (create)
const MAX_BODY_SIZE_KB = 100;
const MAX_LIMIT = 100;

// GET /api/agents - Get user's agents
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user's token
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    // Get query params with bounds checking
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Build query
    let query = supabase
      .from('user_agents')
      .select('*, agent_template:agent_templates(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: agents, error, count } = await query;

    if (error) {
      console.error('Error fetching agents:', error);
      return applySecurityHeaders(NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 }));
    }

    return applySecurityHeaders(NextResponse.json({ agents, count }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

// POST /api/agents - Create a new agent (hire)
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
    
    const supabase = createClient<Database>(
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
    
    const { agent_template_id, name, config } = body;

    if (!agent_template_id || !name) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing required fields: agent_template_id, name' },
        { status: 400 }
      ));
    }

    // Create the agent
    const { data: agent, error } = await supabase
      .from('user_agents')
      .insert({
        user_id: user.id,
        agent_template_id,
        name,
        config: config || {},
        status: 'offline',
      } as any)
      .select('*, agent_template:agent_templates(*)')
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      return applySecurityHeaders(NextResponse.json({ error: 'Failed to create agent' }, { status: 500 }));
    }

    return applySecurityHeaders(NextResponse.json({ agent }, { status: 201 }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
