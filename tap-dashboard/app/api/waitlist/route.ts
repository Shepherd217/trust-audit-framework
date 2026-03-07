import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, agent_id, public_key, source = 'curl' } = body;

    // Check for duplicates
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .or(`email.eq.${email},agent_id.eq.${agent_id}`)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Already on waitlist' },
        { status: 409 }
      );
    }

    // Insert new entry (without source column)
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert([{ email, agent_id, public_key }]);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    // Get position
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      message: 'Joined waitlist',
      position: count || 1,
      opens: '2026-03-10T00:00:00Z'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
