import { NextRequest, NextResponse } from 'next/server';
import { kill } from '@/lib/claw/kernel';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const result = await kill(id);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
