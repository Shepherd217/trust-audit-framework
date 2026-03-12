import { NextRequest, NextResponse } from 'next/server';
import { getVMMetrics } from '@/lib/claw/vm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface VMMetrics {
  cpuTime: number;
  memoryUsage: number;
  diskIO: number;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const metrics: VMMetrics | null = await getVMMetrics(id);

    if (!metrics) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get VM metrics', message },
      { status: 500 }
    );
  }
}
