import { NextRequest, NextResponse } from 'next/server';
import { cancelExecution } from '@/lib/claw/scheduler';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/claw/scheduler/executions/[id]/cancel
 * Cancel a running execution
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    const result = await cancelExecution(id);

    if (!result) {
      return NextResponse.json(
        { error: 'Execution not found or cannot be cancelled' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Execution cancelled', executionId: id },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to cancel execution', message },
      { status: 400 }
    );
  }
}
