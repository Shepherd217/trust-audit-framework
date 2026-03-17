import { NextRequest, NextResponse } from 'next/server';
import { share } from '@/lib/claw/fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.fileId || typeof body.fileId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid fileId field' },
        { status: 400 }
      );
    }
    
    if (!body.targetAgentId || typeof body.targetAgentId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid targetAgentId field' },
        { status: 400 }
      );
    }
    
    if (!body.permissions || !['read', 'write', 'admin'].includes(body.permissions)) {
      return NextResponse.json(
        { error: 'Missing or invalid permissions field (must be read, write, or admin)' },
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
    
    const policy = await share({
      fileId: body.fileId,
      targetAgentId: body.targetAgentId,
      permissions: body.permissions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    }, agentId);
    
    return NextResponse.json({ success: true, policy }, { status: 201 });
  } catch (error) {
    console.error('Share file error:', error);
    
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
