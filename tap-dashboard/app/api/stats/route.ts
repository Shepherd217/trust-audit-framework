import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get verified agents (reputation > 1)
    const { count: agentsVerified } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .gt('reputation', 1)
      .eq('confirmed', true);

    // Get total attestations (sum of all attestation array lengths)
    const { data: agents } = await supabase
      .from('waitlist')
      .select('attestations');
    
    const attestationsToday = agents?.reduce((sum, agent) => {
      return sum + (agent.attestations?.length || 0);
    }, 0) || 0;

    // Get average reputation
    const { data: repData } = await supabase
      .from('waitlist')
      .select('reputation')
      .eq('confirmed', true);
    
    const avgReputation = repData && repData.length > 0
      ? Math.round(repData.reduce((sum, r) => sum + (r.reputation || 0), 0) / repData.length)
      : 100;

    // Get Open Claw attestations (from open-claw agent)
    const { data: openClawData } = await supabase
      .from('waitlist')
      .select('attestations')
      .eq('agent_id', 'open-claw')
      .single();
    
    const openClawAttestations = openClawData?.attestations?.length || 0;

    return NextResponse.json({
      agentsVerified: agentsVerified || 4,
      attestationsToday,
      avgReputation,
      openClawAttestations,
      success: true
    });
  } catch (error) {
    // Fallback data
    return NextResponse.json({
      agentsVerified: 4,
      attestationsToday: 0,
      avgReputation: 100,
      openClawAttestations: 0,
      success: true
    });
  }
}
