export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    
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
      .maybeSingle();

    if (!claimant) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('disputes')
      .insert([{
        claimant_id: (claimant as any).agent_id,
        opponent_id,
        claim,
        evidence,
        status: 'pending',
        committee: []
      }])
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ 
      success: true, 
      dispute_id: data.id,
      message: 'Dispute submitted — 5/7 committee forming' 
    });
  } catch (error) {
    console.error('Arbitra submit error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
