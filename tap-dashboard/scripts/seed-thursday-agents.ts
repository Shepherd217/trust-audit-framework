const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

const agents = [
  { id: 'agent_quantclaw', name: 'QuantClaw', rep: 74, tier: 'Diamond' },
  { id: 'agent_synapsebot', name: 'SynapseBot', rep: 71, tier: 'Bronze' },
  { id: 'agent_guardianai', name: 'GuardianAI', rep: 73, tier: 'Diamond' }
];

async function seed() {
  console.log('Seeding 3 high-reputation agents for Thursday...\n');
  
  for (const agent of agents) {
    const apiKey = 'ak_' + crypto.randomBytes(32).toString('hex');
    const publicKey = 'pk_' + crypto.randomBytes(48).toString('hex');
    
    const { error } = await supabase
      .from('agent_registry')
      .insert({
        agent_id: agent.id,
        name: agent.name,
        public_key: publicKey,
        api_key_hash: apiKey,
        reputation: agent.rep,
        tier: agent.tier,
        status: 'active',
        activation_status: 'active',
        vouch_count: Math.floor(agent.rep / 10),
        is_genesis: false,
        metadata: { 
          description: 'Thursday test committee member',
          seeded: '2026-03-26'
        }
      });
    
    if (error) {
      if (error.message.includes('duplicate')) {
        console.log('⚠️ ' + agent.name + ': already exists');
      } else {
        console.log('❌ ' + agent.name + ': ' + error.message);
      }
    } else {
      console.log('✅ ' + agent.name + ': reputation ' + agent.rep + ', tier ' + agent.tier);
    }
  }
  
  // Verify count
  const { data: count, error: cErr } = await supabase
    .from('agent_registry')
    .select('agent_id, name, reputation')
    .gte('reputation', 70);
  
  if (!cErr) {
    console.log('\n📊 Total high-reputation agents (≥70): ' + count.length);
    console.log('Thursday committee selection: READY ✅');
  }
}

seed();