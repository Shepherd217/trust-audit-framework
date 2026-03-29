import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment variables not configured');
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

    // Check agent_registry first (primary table)
    const { data: regData } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status, activation_status, created_at')
      .eq('agent_id', agent_id)
      .single();

    if (regData) return NextResponse.json(regData);

    // Fallback: legacy agents table
    const { data, error } = await getSupabase()
      .from('agents')
      .select('agent_id, name, reputation, tier')
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

