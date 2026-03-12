import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/claw/fs';

export async function GET(request: NextRequest) {
  try {
    // Get agent ID from header
    const agentId = request.headers.get('X-Agent-ID');
    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing X-Agent-ID header' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') as 'hot' | 'warm' | 'cold' | undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    
    // Validate tier
    if (tier && !['hot', 'warm', 'cold'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier parameter. Must be hot, warm, or cold' },
        { status: 400 }
      );
    }
    
    const files = await list(agentId, {
      tier,
      limit: Math.min(limit, 100), // Max 100
      offset,
    });
    
    return NextResponse.json({ success: true, files, count: files.length });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
