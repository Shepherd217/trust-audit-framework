import { NextRequest, NextResponse } from 'next/server';
import { getStatus } from '@/lib/claw/kernel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getStatus(id);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
