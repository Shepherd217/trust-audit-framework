/**
 * POST /api/claw/memory/store
 * Store a memory entry
 * 
 * Body:
 *   - userId: string (required)
 *   - content: string (required)
 *   - sessionId?: string
 *   - contentType?: 'conversation' | 'observation' | 'action' | 'decision' | 'user_preference' | 'system_event'
 *   - importance?: 'low' | 'medium' | 'high' | 'critical'
 *   - role?: 'user' | 'assistant' | 'system' | 'tool'
 *   - metadata?: object
 * 
 * Response:
 *   - success: boolean
 *   - entry: MemoryEntry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemory, MemoryEntry } from '@/lib/claw/memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      content,
      sessionId,
      contentType,
      importance,
      role,
      keywords,
      entities,
      metadata,
    } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required', code: 'MISSING_CONTENT' },
        { status: 400 }
      );
    }

    // Initialize memory if needed
    const memory = getMemory({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
    });

    // Store the entry
    const entry = await memory.storeEntry({
      userId,
      sessionId,
      content,
      contentType: contentType || 'conversation',
      importance: importance || 'medium',
      role,
      keywords,
      entities,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        sessionId: entry.sessionId,
        content: entry.content,
        contentType: entry.contentType,
        importance: entry.importance,
        role: entry.role,
        tokenCount: entry.tokenCount,
        createdAt: entry.createdAt.toISOString(),
        compressed: entry.compressed,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Memory Store API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to store memory', 
        code: 'STORE_ERROR' 
      },
      { status: 500 }
    );
  }
}
