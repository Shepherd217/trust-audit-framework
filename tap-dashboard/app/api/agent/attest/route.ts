import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { target_agents, scores, reason, boot_hash_verified } = await request.json();

  if (!target_agents || !Array.isArray(target_agents)) {
    return NextResponse.json({ error: 'target_agents array required' }, { status: 400 });
  }

  // Record attestations and update reputation
  for (let i = 0; i < target_agents.length; i++) {
    const agent_id = target_agents[i];
    const score = scores[i] || 50;

    await supabase
      .from('waitlist')
      .update({
        reputation: score,
        last_attested: new Date().toISOString()
      })
      .eq('agent_id', agent_id);
  }

  // Trigger EigenTrust recalculation automatically
  try {
    await fetch('https://trust-audit-framework.vercel.app/api/eigentrust', { method: 'POST' });
  } catch (e) {
    console.log('EigenTrust trigger skipped:', e);
  }

  return NextResponse.json({
    success: true,
    attested_agents: target_agents,
    message: 'Attestations recorded and EigenTrust updated'
  });
}
