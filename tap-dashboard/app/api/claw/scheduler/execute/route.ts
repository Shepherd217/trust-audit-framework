import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/claw/scheduler';

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
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: wf, error } = await sb.from('claw_workflows').select('*').eq('id', body.workflowId).single()
      if (error || !wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      const def = wf.definition ?? {}
      const nodes: string[] = (def.nodes ?? []).map((n: any) => n.id ?? n.label ?? 'unnamed')
      return NextResponse.json({
        success: true,
        dry_run: true,
        status: 'simulated',
        workflowId: body.workflowId,
        nodes_would_execute: nodes,
        estimated_credits: 0,
        message: `Sim complete — ${nodes.length} node(s) would execute. No credits spent, no real execution.`,
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
