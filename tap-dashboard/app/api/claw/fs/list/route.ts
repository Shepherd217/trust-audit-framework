export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/claw/fs';
import { StorageTier } from '@/lib/claw/fs/types';

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
    
    // Validate and convert tier to StorageTier type
    let tier: StorageTier | undefined;
    if (tierParam) {
      if (!['hot', 'warm', 'cold'].includes(tierParam)) {
        return NextResponse.json(
          { error: 'Invalid tier parameter. Must be hot, warm, or cold' },
          { status: 400 }
        );
      }
      // StorageTier is a type union, use the string directly
      tier = tierParam as StorageTier;
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
