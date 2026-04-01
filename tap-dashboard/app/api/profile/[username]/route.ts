import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase as Database } from '@/lib/database.extensions';

interface RouteParams {
  params: Promise<{ username: string }>;
}

// GET /api/profile/[username] - Get public profile by username
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params;
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || ''
    );

    // Get profile by username
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, tap_score, tier, created_at')
      .eq('username', username)
      .single();

    if (error || !profileData) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const profile = profileData as any;

    // Get user's agents (public info only)
    const { data: agents, error: agentsError } = await supabase
      .from('user_agents')
      .select('id, name, status, agent_template:agent_templates(name, type, icon)')
      .eq('user_id', profile.id)
      .eq('status', 'online')
      .limit(10);

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
    }

    // Get attestations received (public)
    const { count: attestationsReceived } = await supabase
      .from('attestations')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', profile.id);

    return NextResponse.json({
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        tap_score: profile.tap_score,
        tier: profile.tier,
        created_at: profile.created_at,
        total_agents: agents?.length || 0,
        online_agents: agents || [],
        total_attestations: attestationsReceived || 0,
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
