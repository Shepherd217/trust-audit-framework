import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

// PATCH /api/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
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
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/profile - Get current user's profile
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Get agent count
    const { count: agentCount } = await supabase
      .from('user_agents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    return NextResponse.json({ 
      profile: Object.assign({}, profile, { total_agents: agentCount || 0 })
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
