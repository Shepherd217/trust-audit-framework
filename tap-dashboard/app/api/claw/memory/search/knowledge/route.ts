export const dynamic = 'force-dynamic';

/**
 * GET /api/claw/memory/search/knowledge
 * Query what the agent knows about a specific topic
 * 
 * Query Parameters:
 *   - userId: string (required)
 *   - topic: string (required) - The topic to query knowledge about
 *   - limit: number (default: 10)
 * 
 * Response:
 *   - success: boolean
 *   - topic: string
 *   - summary: string
 *   - memories: MemorySearchResult[]
 *   - relatedTopics: string[]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemory } from '@/lib/claw/memory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const topic = searchParams.get('topic');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!topic) {
      return NextResponse.json(
        { error: 'topic is required', code: 'MISSING_TOPIC' },
        { status: 400 }
      );
    }

    // Initialize memory
    const memory = getMemory({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
    });

    // Query knowledge about the topic
    const knowledge = await memory.queryKnowledge(userId, topic);

    return NextResponse.json({
      success: true,
      topic,
      summary: knowledge.summary,
      memoryCount: knowledge.memories.length,
      memories: knowledge.memories.slice(0, limit).map(m => ({
        id: m.id,
        content: m.content,
        contentType: m.contentType,
        importance: m.importance,
        similarity: Math.round(m.similarity * 100) / 100,
        createdAt: m.createdAt.toISOString(),
      })),
      relatedTopics: knowledge.relatedTopics,
    });

  } catch (error: any) {
    console.error('[Memory Knowledge API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to query knowledge', 
        code: 'KNOWLEDGE_ERROR' 
      },
      { status: 500 }
    );
  }
}
