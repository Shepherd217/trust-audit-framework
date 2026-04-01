import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const supabase = createTypedClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function sync() {
  console.log('=== Syncing agents ===\n');
  
  const { data: agents } = await supabase
    .from('agents')
    .select('agent_id, name, public_key, reputation, tier');
  
  for (const agent of agents || []) {
    if (!agent.agent_id || agent.agent_id.includes('null')) continue;
    
    const { error } = await supabase
      .from('agent_registry')
      .upsert({
        agent_id: agent.agent_id,
        name: agent.name || agent.agent_id,
        public_key: agent.public_key,
        api_key_hash: 'seed_hash',
        reputation: agent.reputation || 50,
        tier: agent.tier || 'bronze',
        status: 'active'
      }, { onConflict: 'agent_id' });
    
    if (error) console.error(`❌ ${agent.agent_id}: ${error.message}`);
    else console.log(`✅ ${agent.name}`);
  }
  
  console.log('\n=== Creating test dispute ===');
  
  const { error: dError } = await supabase
    .from('dispute_cases')
    .insert({
      id: 'a983199a-5366-466d-ab0a-5f477d5df7d1',
      target_id: 'agent_testagent_01',
      target_type: 'agent',
      reporter_id: 'agent_testagent_02',
      reason: 'ARBITER integration test dispute',
      status: 'pending',
      bond_amount: 100
    });
  
  if (dError?.message?.includes('duplicate')) console.log('✅ Test dispute exists');
  else if (dError) console.error('❌', dError.message);
  else console.log('✅ Test dispute created');
}

sync();
