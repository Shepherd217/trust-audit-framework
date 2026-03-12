import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/claw/scheduler';

/**
 * POST /api/claw/scheduler/execute
 * Start a workflow execution
 * Body: { workflowId, input, context }
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

    const { workflowId, input, context } = body;

    if (!workflowId || typeof workflowId !== 'string') {
      return NextResponse.json(
        { error: 'workflowId is required and must be a string' },
        { status: 400 }
      );
    }

    const execution = await executeWorkflow({
      workflowId,
      input: input ?? {},
      context: context ?? {},
    });

    return NextResponse.json(execution, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to start execution', message },
      { status: 400 }
    );
  }
}
