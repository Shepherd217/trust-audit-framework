export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase as Database } from '@/lib/database.extensions';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

const MAX_BODY_SIZE_KB = 50;

// PATCH /api/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    // Validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      ));
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
    
    const { 
      display_name, 
      username, 
      bio, 
      website, 
      twitter, 
      github, 
      avatar_url 
    } = body;

    // Check username uniqueness if being updated
    if (username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        return applySecurityHeaders(NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        ));
      }
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        display_name,
        username,
        bio,
        website,
        twitter,
        github,
        avatar_url,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating profile:', error);
      return applySecurityHeaders(NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      ));
    }

    return applySecurityHeaders(NextResponse.json({ profile }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}

// GET /api/profile - Get current user's profile
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return applySecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      ));
    }

    // Get agent count
    const { count: agentCount } = await supabase
      .from('user_agents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return applySecurityHeaders(NextResponse.json({ 
      profile: Object.assign({}, profile, { total_agents: agentCount || 0 })
    }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
