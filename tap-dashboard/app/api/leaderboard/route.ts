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

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('waitlist')
      .select('agent_id, referral_count, id')
      .order('referral_count', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Calculate boosted positions
    const withBoost = (data || []).map((item: any, index: number) => ({
      agent_id: item.agent_id,
      referral_count: item.referral_count || 0,
      position: index + 1,
      boosted: Math.max(1, index + 1 - Math.floor((item.referral_count || 0) / 3) * 5)
    }));

    return NextResponse.json(withBoost);
  } catch (error) {
    return NextResponse.json([]);
  }
}
