import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { opponent_id, evidence, claim } = await request.json();

  const { data, error } = await supabase
    .from('disputes')
    .insert([{
      claimant_id: 'open-claw', // or current agent
      opponent_id,
      evidence,
      claim,
      status: 'pending',
      committee: [] // will be filled by EigenTrust
    }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-select committee and notify
  await fetch('https://trust-audit-framework.vercel.app/api/agent/open-claw-loop', { 
    method: 'GET' 
  });

  return NextResponse.json({ success: true, dispute_id: data[0].id });
}
