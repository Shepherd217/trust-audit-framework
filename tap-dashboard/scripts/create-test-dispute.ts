import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function createDispute() {
  console.log('=== Creating Test Dispute in dispute_cases ===\n');
  
  // Get two agents
  const { data: agents } = await supabase
    .from('agents')
    .select('agent_id')
    .in('agent_id', ['agent_testagent_01', 'agent_testagent_02']);
  
  if (!agents || agents.length < 2) {
    console.error('❌ Need 2 agents');
    return;
  }
  
  const [target, reporter] = agents;
  
  // Check if dispute_cases table exists first
  const { error: checkError } = await supabase
    .from('dispute_cases')
    .select('id')
    .limit(1);
  
  if (checkError && checkError.message.includes('does not exist')) {
    console.error('❌ dispute_cases table does not exist');
    console.log('   Creating in disputes table instead...');
    
    // Try disputes table
    const { error: d2 } = await supabase
      .from('disputes')
      .insert({
        id: 'a983199a-5366-466d-ab0a-5f477d5df7d1',
        claim: 'ARBITER test dispute',
        claimant_id: target.agent_id,
        opponent_id: reporter.agent_id,
        dispute_status: 'pending'
      });
    
    if (d2) console.error('❌ disputes failed:', d2.message);
    else console.log('✅ Created in disputes table');
    return;
  }
  
  // Create in dispute_cases
  const { error } = await supabase
    .from('dispute_cases')
    .insert({
      id: 'a983199a-5366-466d-ab0a-5f477d5df7d1',
      target_id: target.agent_id,
      target_type: 'agent',
      reporter_id: reporter.agent_id,
      reason: 'Test dispute for ARBITER integration test',
      status: 'pending',
      bond_amount: 100
    });
  
  if (error) {
    if (error.message.includes('duplicate')) {
      console.log('✅ Test dispute already exists in dispute_cases');
    } else {
      console.error('❌ Failed:', error.message);
    }
  } else {
    console.log('✅ Test dispute created in dispute_cases');
    console.log(`   ID: a983199a-5366-466d-ab0a-5f477d5df7d1`);
    console.log(`   Target: ${target.agent_id}`);
    console.log(`   Reporter: ${reporter.agent_id}`);
  }
}

createDispute();
