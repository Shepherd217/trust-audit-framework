import { NextRequest, NextResponse } from 'next/server';
import { list, StorageTier } from '@/lib/claw/fs';

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
    const tierParam = searchParams.get('tier');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);
    
    // Validate and convert tier to StorageTier enum
    let tier: StorageTier | undefined;
    if (tierParam) {
      if (!['hot', 'warm', 'cold'].includes(tierParam)) {
        return NextResponse.json(
          { error: 'Invalid tier parameter. Must be hot, warm, or cold' },
          { status: 400 }
        );
      }
      // Convert string to StorageTier enum
      switch (tierParam) {
        case 'hot':
          tier = StorageTier.HOT;
          break;
        case 'warm':
          tier = StorageTier.WARM;
          break;
        case 'cold':
          tier = StorageTier.COLD;
          break;
      }
    }
    
    const files = await list(agentId, {
      tier,
      limit: Math.min(limit, 100),
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
