import { NextRequest, NextResponse } from 'next/server';
import { spawn } from '@/lib/claw/kernel';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const agentProcess = await spawn(body);
    return NextResponse.json({ success: true, process: agentProcess });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
