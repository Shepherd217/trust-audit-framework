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
    const { data, error } = await getSupabase()
      .from('waitlist')
      .select('id, agent_id, email, public_key, referral_count, confirmed, staking_status, nft_minted')
      .eq('agent_id', agent_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Agent fetch error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
