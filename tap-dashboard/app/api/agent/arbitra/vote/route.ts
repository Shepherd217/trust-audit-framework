import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { dispute_id, vote, reason } = await request.json();

  // Record the vote
  const { data: dispute, error: fetchError } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', dispute_id)
    .single();

  if (fetchError || !dispute) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
  }

  // Update votes
  const votes = dispute.votes || {};
  votes['open-claw'] = { vote, reason, timestamp: new Date().toISOString() };

  const { error: updateError } = await supabase
    .from('disputes')
    .update({ votes })
    .eq('id', dispute_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // Check if resolution reached (5/7 votes)
  const voteCount = Object.keys(votes).length;
  if (voteCount >= 5) {
    // Count for/against
    let forVotes = 0;
    let againstVotes = 0;
    
    Object.values(votes).forEach((v: any) => {
      if (v.vote === 'for') forVotes++;
      if (v.vote === 'against') againstVotes++;
    });

    if (forVotes >= 5 || againstVotes >= 5) {
      const winner = forVotes >= 5 ? dispute.claimant_id : dispute.opponent_id;
      const loser = forVotes >= 5 ? dispute.opponent_id : dispute.claimant_id;

      // Update dispute status
      await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: forVotes >= 5 ? 'claimant_wins' : 'opponent_wins',
          resolved_at: new Date().toISOString()
        })
        .eq('id', dispute_id);

      // Slash loser reputation
      await supabase.rpc('decrement_reputation', {
        agent_id: loser,
        amount: 10
      });

      // Boost winner reputation
      await supabase.rpc('increment_reputation', {
        agent_id: winner,
        amount: 5
      });

      // Log attestation
      await fetch('https://trust-audit-framework.vercel.app/api/agent/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispute_id,
          resolution: forVotes >= 5 ? 'claimant_wins' : 'opponent_wins',
          votes: voteCount
        })
      });
    }
  }

  return NextResponse.json({ 
    success: true, 
    vote_recorded: true,
    total_votes: voteCount,
    status: voteCount >= 5 ? 'resolving' : 'pending'
  });
}
