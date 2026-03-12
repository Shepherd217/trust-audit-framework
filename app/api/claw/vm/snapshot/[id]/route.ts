import { NextRequest, NextResponse } from 'next/server';
import { createVMSnapshot } from '@/lib/claw/vm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const snapshot = await createVMSnapshot(id);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'VM not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create snapshot', message },
      { status: 500 }
    );
  }
}
