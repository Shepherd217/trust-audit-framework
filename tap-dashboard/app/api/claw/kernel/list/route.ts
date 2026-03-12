import { NextRequest, NextResponse } from 'next/server';
import { listProcesses } from '@/lib/claw/kernel';

export async function GET(request: NextRequest) {
  try {
    const processes = await listProcesses();
    return NextResponse.json({ success: true, processes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
