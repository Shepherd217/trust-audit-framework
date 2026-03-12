import { NextRequest, NextResponse } from 'next/server';
import { listVMs } from '@/lib/claw/vm';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || undefined;
    const state = searchParams.get('state') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const vms = await listVMs({ agentId, state, limit });

    return NextResponse.json(vms);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list VMs', message },
      { status: 500 }
    );
  }
}
