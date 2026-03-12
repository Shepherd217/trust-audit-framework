import { NextRequest, NextResponse } from 'next/server';
import { pauseVM } from '@/lib/claw/vm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const success = await pauseVM(id);

    if (!success) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to pause VM', message },
      { status: 500 }
    );
  }
}
