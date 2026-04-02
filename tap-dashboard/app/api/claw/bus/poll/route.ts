export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (!agentId) {
      return NextResponse.json({ error: 'agentId query parameter is required' }, { status: 400 });
    }
    
    const service = getClawBusService();
    const messages = await service.poll(agentId);
    return NextResponse.json({ success: true, messages });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
