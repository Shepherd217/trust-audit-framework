import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const service = getClawBusService();
    const result = await service.ack(id);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
