import { NextRequest, NextResponse } from 'next/server';
import { getWorkflow, deleteWorkflow } from '@/lib/claw/scheduler';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/claw/scheduler/workflows/[id]
 * Get a workflow by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const workflow = await getWorkflow(id);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get workflow', message },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/claw/scheduler/workflows/[id]
 * Delete a workflow by ID
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const success = await deleteWorkflow(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Workflow deleted' },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete workflow', message },
      { status: 400 }
    );
  }
}
