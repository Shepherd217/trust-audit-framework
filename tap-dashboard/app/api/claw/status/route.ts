import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}


export async function GET(_request: NextRequest) {
  try {
    // Check all new tables exist
    const tables = [
      'clawbus_agents',
      'clawbus_messages', 
      'clawbus_handoffs',
      'claw_workflows',
      'claw_workflow_executions',
      'claw_node_executions',
      'clawvm_instances',
      'clawvm_snapshots',
      'claw_agent_sessions',
      'claw_system_events'
    ];
    
    const results: Record<string, boolean> = {};
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });
      
      results[table] = !error;
    }
    
    const allPresent = Object.values(results).every(v => v);
    
    return NextResponse.json({
      status: allPresent ? 'healthy' : 'degraded',
      components: {
        bus: results['clawbus_agents'] && results['clawbus_messages'],
        scheduler: results['claw_workflows'] && results['claw_workflow_executions'],
        vm: results['clawvm_instances'] && results['clawvm_snapshots'],
        integration: results['claw_agent_sessions'] && results['claw_system_events']
      },
      tables: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: (error as Error).message
    }, { status: 500 });
  }
}
