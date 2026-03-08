import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const { opponent_id, claim, evidence } = await request.json();

  // Get claimant from token (dynamic, secure)
  const { data: claimant } = await supabase
    .from('waitlist')
    .select('agent_id')
    .eq('agent_token', token)
    .single();

  if (!claimant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('disputes')
    .insert([{
      claimant_id: claimant.agent_id,
      opponent_id,
      claim,
      evidence,
      status: 'pending',
      committee: []
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-notify Open Claw for committee formation
  await fetch('https://trust-audit-framework.vercel.app/api/agent/open-claw-loop');

  return NextResponse.json({ 
    success: true, 
    dispute_id: data.id,
    message: 'Dispute submitted — 5/7 committee forming' 
  });
}
