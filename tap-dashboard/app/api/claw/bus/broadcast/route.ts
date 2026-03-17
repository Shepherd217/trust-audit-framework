import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = getClawBusService();
    const message = await service.broadcast(body);
    return NextResponse.json({ success: true, message });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
