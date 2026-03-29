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

    const workflow = await createWorkflow(def);
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
