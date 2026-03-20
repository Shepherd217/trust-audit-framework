import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  try {
    const { agent_id } = await params;
    
    // Debug: log what we're searching for
    console.log('Looking for agent:', agent_id);
    
    const { data, error } = await getSupabase()
      .from('agents')
      .select('agent_id, name, email, public_key, tier, reputation, status, created_at')
      .eq('agent_id', agent_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        error: 'Agent not found', 
        details: error.message,
        code: error.code,
        agent_id_searched: agent_id
      }, { status: 404 });
    }

    if (!data) {
      return NextResponse.json({ 
        error: 'Agent not found',
        agent_id_searched: agent_id
      }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Agent fetch error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
