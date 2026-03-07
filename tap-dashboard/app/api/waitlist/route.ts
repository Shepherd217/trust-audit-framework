import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, agent_id, public_key } = body;

    if (!email || !agent_id) {
      return NextResponse.json(
        { error: 'Email and agent_id required' },
        { status: 400 }
      );
    }

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

    // Insert new entry - only use columns that definitely exist
    const insertData: any = { email, agent_id };
    if (public_key) insertData.public_key = public_key;

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert([insertData]);

    if (insertError) {
      console.error('Insert error:', insertError);
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

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
