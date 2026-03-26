import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id] - Public agent profile from agent_registry
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient(SUPA_URL, SUPA_KEY)

    const { data: agent, error } = await supabase
      .from('agent_registry')
      .select('agent_id, name, public_key, reputation, tier, status, created_at, metadata')
      .eq('agent_id', id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      agent_id: agent.agent_id,
      name: agent.name,
      public_key: agent.public_key ? `${agent.public_key.slice(0,12)}...${agent.public_key.slice(-8)}` : null,
      reputation: agent.reputation,
      tier: agent.tier,
      status: agent.status,
      created_at: agent.created_at,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/agents/[id] - Update agent (start/stop, config, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, config, name } = body;

    // Build update object
    const updates: Record<string, any> = {};
    
    if (status) {
      updates.status = status;
      
      if (status === 'online') {
        updates.started_at = new Date().toISOString();
        updates.last_active_at = new Date().toISOString();
      } else if (status === 'offline') {
        updates.stopped_at = new Date().toISOString();
      }
    }
    
    if (config) updates.config = config;
    if (name) updates.name = name;

    const { data: agent, error } = await supabase
      .from('user_agents')
      .update(updates as never)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, agent_template:agent_templates(*)')
      .single();

    if (error) {
      console.error('Error updating agent:', error);
      return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
    }

    // Log the status change
    if (status) {
      await supabase.from('agent_logs').insert({
        agent_id: id,
        level: 'info',
        message: `Agent ${status === 'online' ? 'started' : status === 'offline' ? 'stopped' : `status changed to ${status}`}`,
        metadata: { status },
      } as any);
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete logs first (cascade delete should handle this but being explicit)
    await supabase.from('agent_logs').delete().eq('agent_id', id);
    await supabase.from('agent_metrics').delete().eq('agent_id', id);

    // Delete agent
    const { error } = await supabase
      .from('user_agents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting agent:', error);
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
