import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { dispute_id, vote, reason } = await request.json();

    // Verify voter is in committee (simple check for MVP)
    const { data: dispute } = await getSupabase()
      .from('disputes')
      .select('*')
      .eq('id', dispute_id)
      .single();

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

    // Record vote and check if majority reached
    const newCommittee = [...((dispute as any).committee || []), { agent_id: 'open-claw', vote, reason }];

    const forVotes = newCommittee.filter(v => v.vote === 'for').length;

    let status = (dispute as any).status;
    let resolution = (dispute as any).resolution;

    if (forVotes >= 5) {
      status = 'resolved';
      resolution = `Resolved in favor of claimant`;
      await (getSupabase() as any).rpc('slash_reputation', { agent: (dispute as any).opponent_id, amount: 10 } as any);
    }

    await (getSupabase() as any)
      .from('disputes')
      .update({ committee: newCommittee, status, resolution })
      .eq('id', dispute_id);

    return NextResponse.json({ success: true, status, resolution });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
