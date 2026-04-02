export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/claw/fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query field' },
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
    
    // Parse filters
    const filters: any = body.filters ?? {};
    
    // Convert date strings to Date objects if present
    if (filters.createdAfter) {
      filters.createdAfter = new Date(filters.createdAfter);
    }
    if (filters.createdBefore) {
      filters.createdBefore = new Date(filters.createdBefore);
    }
    
    const files = await search({
      query: body.query,
      filters,
    }, agentId);
    
    return NextResponse.json({ success: true, files, count: files.length });
  } catch (error) {
    console.error('Search files error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
