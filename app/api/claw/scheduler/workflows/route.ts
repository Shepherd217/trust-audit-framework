import { NextRequest, NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/claw/scheduler';

/**
 * POST /api/claw/scheduler/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const workflow = await createWorkflow(body);

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create workflow', message },
      { status: 400 }
    );
  }
}

/**
 * GET /api/claw/scheduler/workflows
 * List all workflows
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const workflows = await listWorkflows({ limit, offset });

    return NextResponse.json(workflows, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list workflows', message },
      { status: 400 }
    );
  }
}
