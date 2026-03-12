import { NextRequest, NextResponse } from 'next/server';
import { restoreVMSnapshot } from '@/lib/claw/vm';

interface RestoreBody {
  snapshotId: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: RestoreBody = await request.json();

    if (!body.snapshotId) {
      return NextResponse.json(
        { error: 'snapshotId is required' },
        { status: 400 }
      );
    }

    const vmInstance = await restoreVMSnapshot(body.snapshotId);

    if (!vmInstance) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(vmInstance, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to restore snapshot', message },
      { status: 500 }
    );
  }
}
