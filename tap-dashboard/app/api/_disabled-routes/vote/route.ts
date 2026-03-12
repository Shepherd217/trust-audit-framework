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
  const { dispute_id, vote, reason } = await request.json();

  // Verify voter is in committee (simple check for MVP)
  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', dispute_id)
    .single();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

  // Record vote and check if majority reached
  const newCommittee = [...(dispute.committee || []), { agent_id: 'open-claw', vote, reason }];

  const forVotes = newCommittee.filter(v => v.vote === 'for').length;

  let status = dispute.status;
  let resolution = dispute.resolution;

  if (forVotes >= 5) {
    status = 'resolved';
    resolution = `Resolved in favor of claimant`;
    await supabase.rpc('slash_reputation', { agent: dispute.opponent_id, amount: 10 });
  }

  await supabase
    .from('disputes')
    .update({ committee: newCommittee, status, resolution })
    .eq('id', dispute_id);

  return NextResponse.json({ success: true, status, resolution });
}
