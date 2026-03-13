export const dynamic = 'force-dynamic';

/**
 * GET /api/claw/memory/search
 * Search memories using semantic + keyword search
 * 
 * Query Parameters:
 *   - userId: string (required)
 *   - q: string (query text, required)
 *   - semantic: boolean (default: true)
 *   - threshold: number (similarity threshold, default: 0.7)
 *   - limit: number (default: 10)
 *   - sessionId?: string (filter by session)
 *   - type?: string (comma-separated list of entry types)
 *   - minImportance?: string ('low' | 'medium' | 'high' | 'critical')
 * 
 * Response:
 *   - success: boolean
 *   - results: MemorySearchResult[]
 *   - query: string
 *   - resultCount: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemory, MemoryEntryType, MemoryImportance } from '@/lib/claw/memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const query = searchParams.get('q');
    const semantic = searchParams.get('semantic') !== 'false';
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const sessionId = searchParams.get('sessionId');
    const typeParam = searchParams.get('type');
    const minImportance = searchParams.get('minImportance') as MemoryImportance | null;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'q (query) is required', code: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    // Parse entry types
    const entryTypes: MemoryEntryType[] | undefined = typeParam 
      ? typeParam.split(',') as MemoryEntryType[]
      : undefined;

    // Initialize memory
    const memory = getMemory({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
    });

    // Perform search
    let results;
    if (semantic) {
      results = await memory.search(userId, query, {
        matchCount: limit,
        matchThreshold: threshold,
        sessionId: sessionId || undefined,
        entryTypes,
        minImportance: minImportance || undefined,
      });
    } else {
      results = await memory.keywordSearch(userId, query, {
        limit,
        sessionId: sessionId || undefined,
        entryTypes,
        minImportance: minImportance || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      query,
      semantic,
      resultCount: results.length,
      results: results.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        content: r.content,
        contentType: r.contentType,
        importance: r.importance,
        similarity: Math.round(r.similarity * 100) / 100,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
      })),
    });

  } catch (error: any) {
    console.error('[Memory Search API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to search memories', 
        code: 'SEARCH_ERROR' 
      },
      { status: 500 }
    );
  }
}
