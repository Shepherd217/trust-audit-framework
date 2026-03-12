import { NextRequest, NextResponse } from 'next/server';
import { retrieve } from '@/lib/claw/fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }
    
    // Get agent ID from header
    const agentId = request.headers.get('X-Agent-ID');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing X-Agent-ID header' },
        { status: 401 }
      );
    }
    
    const file = await retrieve(id, agentId);
    
    if (!file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 403 }
      );
    }
    
    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('Retrieve file error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
