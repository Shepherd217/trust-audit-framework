import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pgeddexhbqoghdytjvex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'
);

async function check() {
  // Check which table has agents
  const { data: regAgents } = await supabase.from('agent_registry').select('agent_id').limit(3);
  console.log('agent_registry agents:', regAgents?.length || 0);
  
  const { data: agents } = await supabase.from('agents').select('agent_id').limit(3);
  console.log('agents table agents:', agents?.length || 0);
  
  // Check dispute tables
  const { error: dcError } = await supabase.from('dispute_cases').select('id').limit(1);
  console.log('dispute_cases exists:', dcError ? '❌ ' + dcError.message : '✅');
  
  const { error: dError } = await supabase.from('disputes').select('id').limit(1);
  console.log('disputes exists:', dError ? '❌ ' + dError.message : '✅');
}

check();
