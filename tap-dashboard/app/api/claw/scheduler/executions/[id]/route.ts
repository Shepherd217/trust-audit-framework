import { NextRequest, NextResponse } from 'next/server';
import { getExecutionStatus } from '@/lib/claw/scheduler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await getExecutionStatus(id);
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Get execution status error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
