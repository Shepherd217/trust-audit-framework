import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const { data, error } = await supabase
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
  if (data.referrer_agent_id) {
    await supabase.rpc('increment_referral_count', { 
      ref_agent_id: data.referrer_agent_id 
    });
  }

  return NextResponse.redirect('https://trust-audit-framework.vercel.app/?confirmed=true');
}
