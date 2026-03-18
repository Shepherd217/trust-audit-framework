import { NextRequest, NextResponse } from 'next/server';
import { update } from '@/lib/claw/fs';

export async function POST(
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
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid content field' },
        { status: 400 }
      );
    }
    
    if (typeof body.expectedVersion !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid expectedVersion field' },
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
    
    const version = await update(id, {
      content: body.content,
      expectedVersion: body.expectedVersion,
    }, agentId);
    
    return NextResponse.json({ success: true, version });
  } catch (error) {
    console.error('Update file error:', error);
    
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('Insufficient permissions')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }
    
    if (errorMessage.includes('File not found')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }
    
    if (errorMessage.includes('Version mismatch')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
