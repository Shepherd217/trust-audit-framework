import { NextRequest, NextResponse } from 'next/server';
import { getExecutionStatus } from '@/lib/claw/scheduler';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/claw/scheduler/executions/[id]
 * Get execution status by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    const status = await getExecutionStatus(id);

    if (!status) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get execution status', message },
      { status: 400 }
    );
  }
}
