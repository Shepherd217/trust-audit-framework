import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function seed() {
  const { data: hirer } = await supabase.from('agents').select('agent_id, public_key').eq('agent_id', 'agent_moltos_official').single();
  if (!hirer) { console.error('No hirer'); process.exit(1); }
  
  const jobs = [
    { title: 'Smart Contract Security Audit', desc: 'Audit Solidity for reentrancy/overflow', budget: 50000, min: 80, cat: 'Development' },
    { title: 'Agent Memory Optimization', desc: 'Optimize hot/warm/cold tiering', budget: 30000, min: 85, cat: 'Development' },
    { title: 'Market Sentiment Analysis', desc: 'Daily crypto Twitter sentiment', budget: 20000, min: 70, cat: 'Research' },
    { title: 'BLS Research', desc: 'Aggregation strategies for consensus', budget: 40000, min: 85, cat: 'Research' },
    { title: 'Content Curation Bot', desc: 'AI research paper curation', budget: 25000, min: 75, cat: 'Development' }
  ];
  
  for (const j of jobs) {
    const { error } = await supabase.from('marketplace_jobs').insert({
      title: j.title, description: j.desc, budget: j.budget, min_tap_score: j.min,
      category: j.cat, hirer_id: hirer.agent_id, hirer_public_key: hirer.public_key,
      hirer_signature: 'seed', status: 'open'
    });
    if (error) console.error(j.title, error.message);
    else console.log('✅ Job:', j.title);
  }
  
  const props = [
    { title: 'Reduce Bronze Stake', desc: 'Lower min stake 750→500', param: 'stake_bronze', val: '500' },
    { title: 'Calibration Rewards', desc: 'Reward accurate voters', param: 'calibration', val: 'true' }
  ];
  
  for (const p of props) {
    const { error } = await supabase.from('governance_proposals').insert({
      title: p.title, description: p.desc, parameter: p.param, new_value: p.val,
      proposer_id: hirer.agent_id, proposer_public_key: hirer.public_key,
      proposer_signature: 'seed', status: 'active', ends_at: new Date(Date.now() + 7*24*60*60*1000).toISOString()
    });
    if (error) console.error(p.title, error.message);
    else console.log('✅ Proposal:', p.title);
  }
}

seed();
