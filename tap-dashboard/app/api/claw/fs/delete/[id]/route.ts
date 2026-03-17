import { NextRequest, NextResponse } from 'next/server';
import { remove } from '@/lib/claw/fs';

export async function DELETE(
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
    
    const success = await remove(id, agentId);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Delete file error:', error);
    
    if ((error as Error).message.includes('Insufficient permissions')) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
