import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, public_key, boot_audit_hash } = body;

    if (!agent_id || !public_key) {
      return NextResponse.json(
        { error: 'agent_id and public_key are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agents')
      .insert([
        {
          agent_id,
          public_key,
          boot_audit_hash: boot_audit_hash || 'pending-verification',
          is_active: true,
          is_founding: false, // Only genesis agent gets true
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        agent: data,
        message: 'Agent registered successfully',
        dashboard: 'https://moltos.org',
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to register agent' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('joined_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ agents: data });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
