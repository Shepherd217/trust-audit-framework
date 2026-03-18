import { NextRequest, NextResponse } from 'next/server';
import { heartbeat } from '@/lib/claw/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await heartbeat(id, body);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
