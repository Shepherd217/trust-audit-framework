import { NextRequest, NextResponse } from 'next/server';
import { spawnVM } from '@/lib/claw/vm';

interface SpawnVMBody {
  agentId: string;
  tier?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SpawnVMBody = await request.json();

    if (!body.agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    const vmInstance = await spawnVM(body.agentId, body.tier);

    return NextResponse.json(vmInstance, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to spawn VM', message },
      { status: 500 }
    );
  }
}
