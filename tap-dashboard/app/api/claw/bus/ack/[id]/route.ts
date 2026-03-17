import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const service = getClawBusService();
    await service.acknowledge(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
