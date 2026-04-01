import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/claw/scheduler';
import { createTypedClient } from '@/lib/database.extensions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.workflowId) {
      return NextResponse.json(
        { error: 'Missing workflowId' },
        { status: 400 }
      );
    }

    // Dry run / sim mode — validate and preview without executing
    const isDryRun = body.dry_run === true || body.context?.dry_run === true
    if (isDryRun) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: wf, error } = await sb.from('claw_workflows').select('*').eq('id', body.workflowId).single()
      if (error || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      const def = wf.definition ?? {}
      const nodeList: any[] = def.nodes ?? []
      const nodes: string[] = nodeList.map((n: any) => n.id ?? n.label ?? 'unnamed')
      const edges: any[] = def.edges ?? []

      // Estimate: sequential depth via topological sort, ~2s per node in sim
      const inDegree: Record<string, number> = {}
      nodes.forEach(n => { inDegree[n] = 0 })
      edges.forEach((e: any) => { if (inDegree[e.to] !== undefined) inDegree[e.to]++ })
      const parallelNodes = nodes.filter(n => inDegree[n] === 0).length
      const sequentialDepth = Math.ceil(nodes.length / Math.max(1, parallelNodes))
      const estimatedRuntimeMs = sequentialDepth * 2000
      const estimatedRuntimeStr = estimatedRuntimeMs >= 60000
        ? `~${Math.round(estimatedRuntimeMs / 60000)} min`
        : `~${Math.round(estimatedRuntimeMs / 1000)}s`

      return NextResponse.json({
        success: true,
        dry_run: true,
        status: 'simulated',
        workflowId: body.workflowId,
        nodes_would_execute: nodes,
        node_count: nodes.length,
        parallel_nodes: parallelNodes,
        sequential_depth: sequentialDepth,
        estimated_runtime_ms: estimatedRuntimeMs,
        estimated_runtime: estimatedRuntimeStr,
        estimated_credits: 0,  // no credits for compute — credits come from marketplace jobs
        caveats: [
          'Ignores real network latency between nodes',
          'Assumes all nodes succeed — no failure branch simulation',
          'estimated_runtime is a rough heuristic (2s/sequential-level)',
          'Real execution time depends on node complexity and external API calls',
        ],
        message: `Sim complete — ${nodes.length} node(s), estimated ${estimatedRuntimeStr}. No credits spent.`,
        simulated_result: { nodes, input: body.input ?? {}, completed_at: new Date().toISOString() },
      })
    }

    const execution = await executeWorkflow(
      body.workflowId,
      body.input || {},
      body.context || {}
    );
    
    return NextResponse.json({ 
      success: true, 
      executionId: execution.id,
      status: execution.status
    }, { status: 201 });
  } catch (error) {
    console.error('Execute workflow error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
