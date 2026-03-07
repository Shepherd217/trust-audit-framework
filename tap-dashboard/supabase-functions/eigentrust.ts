import { createClient } from '@supabase/supabase-js';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const DAMPING_FACTOR = 0.85; // classic EigenTrust
const ITERATIONS = 20;       // converges fast for n<200 agents

serve(async (req) => {
  const { data: agents } = await supabase
    .from('waitlist')
    .select('agent_id, reputation, attestations')
    .eq('confirmed', true);

  if (!agents || agents.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No agents yet' }), { status: 200 });
  }

  // Build local trust matrix (normalized)
  const n = agents.length;
  const trustMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

  agents.forEach((agent, i) => {
    const atts = agent.attestations || [];
    let totalWeight = 0;
    atts.forEach((att: any) => {
      const j = agents.findIndex(a => a.agent_id === att.verifier_id);
      if (j !== -1) {
        trustMatrix[i][j] = Math.log(1 + att.weight); // logarithmic
        totalWeight += trustMatrix[i][j];
      }
    });
    // Normalize row
    if (totalWeight > 0) {
      for (let j = 0; j < n; j++) trustMatrix[i][j] /= totalWeight;
    }
  });

  // EigenTrust iteration
  let trustVector = new Array(n).fill(1 / n); // initial uniform
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const newTrust: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newTrust[i] += trustMatrix[j][i] * trustVector[j];
      }
    }
    // Add teleportation (damping)
    for (let i = 0; i < n; i++) {
      newTrust[i] = (1 - DAMPING_FACTOR) / n + DAMPING_FACTOR * newTrust[i];
    }
    trustVector = newTrust;
  }

  // Update DB
  const updates = agents.map((agent, i) => ({
    agent_id: agent.agent_id,
    reputation: Math.floor(trustVector[i] * 1000) // 0-1000 scale
  }));

  await supabase.from('waitlist').upsert(updates, { onConflict: 'agent_id' });

  return new Response(JSON.stringify({ 
    success: true, 
    agentsUpdated: n, 
    topRep: updates.sort((a,b)=>b.reputation-a.reputation).slice(0,5) 
  }), { status: 200 });
});
