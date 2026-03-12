import { NextRequest, NextResponse } from 'next/server';
import { getVMStatus } from '@/lib/claw/vm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const vmInstance = await getVMStatus(id);

    if (!vmInstance) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(vmInstance);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get VM status', message },
      { status: 500 }
    );
  }
}
