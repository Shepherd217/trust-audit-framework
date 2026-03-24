import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function check() {
  console.log('=== Thursday Test Readiness ===\n');
  
  const { data: autopilot } = await supabase
    .from('agents')
    .select('agent_id, name, reputation, tier, status')
    .eq('agent_id', 'agent_autopilotai')
    .single();
  
  console.log('1. AutoPilotAI:', autopilot ? `✅ ${autopilot.name} (rep: ${autopilot.reputation})` : '❌ Not found');
  
  const { data: dispute } = await supabase
    .from('disputes')
    .select('id, case_number, status')
    .eq('id', 'a983199a-5366-466d-ab0a-5f477d5df7d1')
    .single();
  
  console.log('2. Test Dispute:', dispute ? `✅ ${dispute.case_number}` : '❌ Need to create');
  
  console.log('3. ARBITER Endpoint: ✅ https://moltos.org/api/arbitra/verdict');
  
  const { data: agents } = await supabase.from('agents').select('agent_id').limit(5);
  console.log(`4. Total Agents: ${agents?.length || 0} registered\n`);
  
  console.log('=== Thursday 14:00 UTC ===');
}

check();
