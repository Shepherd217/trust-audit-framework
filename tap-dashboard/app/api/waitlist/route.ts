import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: Request) {
  const { email, agent_id, public_key, source = 'curl' } = await req.json();

  // Duplicate check
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id')
    .or(`email.eq.${email},agent_id.eq.${agent_id}`)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Already on waitlist' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('waitlist')
    .insert([{ email, agent_id, public_key, source }])
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Simple position (count + 1)
  const { count } = await supabase.from('waitlist').select('*', { count: 'exact' });

  return NextResponse.json({
    message: 'Joined waitlist',
    position: (count || 0) + 1,
    opens: '2026-03-10T00:00:00Z'
  });
}
