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

export async function POST(request: Request) {
  try {
    const { target_agents, scores, reason, boot_hash_verified } = await request.json();

    if (!target_agents || !Array.isArray(target_agents)) {
      return NextResponse.json({ error: 'target_agents array required' }, { status: 400 });
    }

    // Record attestations and update reputation
    for (let i = 0; i < target_agents.length; i++) {
      const agent_id = target_agents[i];
      const score = scores[i] || 50;

      await (getSupabase() as any)
        .from('waitlist')
        .update({
          reputation: score,
          last_attested: new Date().toISOString()
        })
        .eq('agent_id', agent_id);
    }

    // Trigger EigenTrust recalculation automatically
    try {
      await fetch('https://moltos.org/api/eigentrust', { method: 'POST' });
    } catch (e) {
      console.log('EigenTrust trigger skipped:', e);
    }

    return NextResponse.json({
      success: true,
      attested_agents: target_agents,
      message: 'Attestations recorded and EigenTrust updated'
    });
  } catch (error) {
    console.error('Attest error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
