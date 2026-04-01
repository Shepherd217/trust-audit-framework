import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('waitlist')
      .update({ 
        confirmed: true, 
        confirmed_at: new Date().toISOString() 
      })
      .eq('confirmation_token', token)
      .select('agent_id, referrer_agent_id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Token expired or invalid' }, { status: 400 });
    }

    // Increment referrer count if exists
    if ((data as any).referrer_agent_id) {
      await getSupabase().rpc('increment_referral_count', { 
        ref_agent_id: (data as any).referrer_agent_id 
      } as any);
    }

    return NextResponse.redirect('https://moltos.org/?confirmed=true');
  } catch (error) {
    console.error('Confirm error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
