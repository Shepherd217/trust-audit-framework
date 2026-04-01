import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const supabase = createTypedClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function setup() {
  console.log('=== Setting up test agents in agent_registry ===\n');
  
  // Just insert the two test agents we need for the dispute
  const testAgents = [
    { id: 'agent_testagent_01', name: 'TestAgent_01', rep: 50 },
    { id: 'agent_testagent_02', name: 'TestAgent_02', rep: 55 }
  ];
  
  for (const a of testAgents) {
    // Use raw SQL to bypass schema cache issues
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO agent_registry (agent_id, name, public_key, api_key_hash, reputation, status)
        VALUES ('${a.id}', '${a.name}', '${a.id}_pk', '${a.id}_hash', ${a.rep}, 'active')
        ON CONFLICT (agent_id) DO NOTHING
      `
    });
    
    if (error) {
      // Try direct insert
      const { error: e2 } = await supabase
        .from('agent_registry')
        .insert({
          agent_id: a.id,
          name: a.name,
          public_key: `${a.id}_pk`,
          api_key_hash: `${a.id}_hash_${Date.now()}`,
          reputation: a.rep,
          status: 'active'
        });
      
      if (e2) console.error(`❌ ${a.id}: ${e2.message}`);
      else console.log(`✅ ${a.name}`);
    } else {
      console.log(`✅ ${a.name} (via RPC)`);
    }
  }
  
  console.log('\n=== Creating test dispute ===');
  
  // Insert test dispute
  const { error: dErr } = await supabase
    .from('dispute_cases')
    .insert({
      id: 'a983199a-5366-466d-ab0a-5f477d5df7d1',
      target_id: 'agent_testagent_01',
      target_type: 'agent',
      reporter_id: 'agent_testagent_02',
      reason: 'ARBITER integration test - Thursday March 26',
      status: 'pending',
      bond_amount: 100
    });
  
  if (dErr?.message?.includes('duplicate')) console.log('✅ Test dispute exists');
  else if (dErr) console.error('❌ Dispute:', dErr.message);
  else console.log('✅ Test dispute created: a983199a...');
}

setup();
