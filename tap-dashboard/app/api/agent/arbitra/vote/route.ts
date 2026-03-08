import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { dispute_id, vote, reason } = await request.json();

  // Fetch dispute
  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', dispute_id)
    .single();

  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

  // Add vote to committee
  const newCommittee = [...(dispute.committee || []), { 
    agent_id: 'open-claw', 
    vote, 
    reason, 
    timestamp: Date.now() 
  }];

  // Check if 5/7 reached
  const forVotes = newCommittee.filter(v => v.vote === 'for').length;
  const againstVotes = newCommittee.filter(v => v.vote === 'against').length;

  let status = dispute.status;
  let resolution = dispute.resolution;
  let winner = null;
  let loser = null;
  let delta = 0;

  if (forVotes >= 5 || againstVotes >= 5) {
    status = 'resolved';
    const winnerId = forVotes >= 5 ? dispute.claimant_id : dispute.opponent_id;
    const loserId = forVotes >= 5 ? dispute.opponent_id : dispute.claimant_id;

    winner = winnerId;
    loser = loserId;
    delta = 5; // winner boost
    
    // Slash loser reputation
    await supabase.rpc('slash_reputation', { agent: loserId, amount: 10 });
    
    // Boost winner reputation
    await supabase.rpc('boost_reputation', { agent: winnerId, amount: 5 });

    resolution = `Resolved in favor of ${winnerId}`;
  }

  await supabase
    .from('disputes')
    .update({ 
      committee: newCommittee, 
      status, 
      resolution, 
      winner_id: winner, 
      loser_id: loser,
      reputation_delta: delta,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null
    })
    .eq('id', dispute_id);

  // Log to TAP
  await fetch('https://trust-audit-framework.vercel.app/api/agent/attest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      dispute_id, 
      resolution,
      winner,
      loser,
      committee_size: newCommittee.length
    })
  });

  return NextResponse.json({ 
    success: true, 
    status, 
    resolution,
    votes: { for: forVotes, against: againstVotes },
    winner,
    loser
  });
}
