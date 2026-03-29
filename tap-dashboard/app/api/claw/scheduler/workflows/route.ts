import { NextRequest, NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/claw/scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.definition) {
      return NextResponse.json(
        { error: 'Missing workflow definition' },
        { status: 400 }
      );
    }

    // ── Dry-run / sim mode ────────────────────────────────────────────────────
    if (body.dry_run === true) {
      const def = body.definition
      const nodes = def.nodes || def.steps || []
      const simId = `sim_wf_${Date.now().toString(36)}`
      return NextResponse.json({
        success: true,
        dry_run: true,
        simulated: true,
        workflow: {
          id: simId,
          status: 'sim_ready',
          node_count: nodes.length,
          nodes: nodes.map((n: any, i: number) => ({
            id: n.id ?? `node_${i}`,
            label: n.label ?? n.name ?? `Node ${i+1}`,
            status: 'sim_pending',
          })),
          created_at: new Date().toISOString(),
        },
        message: `Dry run: workflow validated with ${nodes.length} node(s). NOT created — no credits used. Remove dry_run to create for real.`,
      }, { status: 200 })
    }

    const def = body.definition;

    // Normalize: support both {nodes, edges} and {steps} formats
    if (!def.nodes && def.steps) {
      def.nodes = def.steps.map((s: any, i: number) => ({
        id: s.id ?? `node_${i}`,
        type: s.type ?? 'task',
        config: s.config ?? {},
        label: s.name ?? s.id ?? `Step ${i + 1}`,
      }));
      // Build edges from depends_on
      def.edges = def.steps
        .filter((s: any) => s.depends_on?.length)
        .flatMap((s: any) => s.depends_on.map((dep: string) => ({
          from: dep, to: s.id ?? `node_${def.steps.indexOf(s)}`,
        })));
    }
    // Ensure edges exists
    if (!def.edges) def.edges = [];

    // Resolve owner from API key
    let ownerId: string | undefined
    const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')
    if (apiKey) {
      const { createHash } = require('crypto')
      const { createClient } = require('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const hash = createHash('sha256').update(apiKey).digest('hex')
      const { data } = await sb.from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
      ownerId = data?.agent_id
    }

    const workflow = await createWorkflow(def, ownerId);
    return NextResponse.json({ success: true, workflow }, { status: 201 });
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate status
    const statusParam = searchParams.get('status');
    let status: 'active' | 'all' | 'inactive' | undefined;
    if (statusParam) {
      if (!['active', 'all', 'inactive'].includes(statusParam)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be active, all, or inactive' },
          { status: 400 }
        );
      }
      status = statusParam as 'active' | 'all' | 'inactive';
    }
    
    const filters = {
      owner: searchParams.get('owner') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      status,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    const result = await listWorkflows(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('List workflows error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
