export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/claw/fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid content field' },
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
    
    const file = await store({
      content: body.content,
      metadata: body.metadata,
      permissions: body.permissions,
    }, agentId);
    
    return NextResponse.json({ success: true, file }, { status: 201 });
  } catch (error) {
    console.error('Store file error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
