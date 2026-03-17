/**
 * POST /api/claw/memory/store/conversation
 * Store a complete conversation turn (user + assistant)
 * 
 * Body:
 *   - userId: string (required)
 *   - userMessage: string (required)
 *   - assistantResponse: string (required)
 *   - sessionId?: string
 *   - metadata?: object
 * 
 * Response:
 *   - success: boolean
 *   - sessionId: string
 *   - entries: { user: MemoryEntry, assistant: MemoryEntry }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMemory } from '@/lib/claw/memory';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userMessage,
      assistantResponse,
      sessionId,
      metadata,
    } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'userMessage is required', code: 'MISSING_USER_MESSAGE' },
        { status: 400 }
      );
    }

    if (!assistantResponse || typeof assistantResponse !== 'string') {
      return NextResponse.json(
        { error: 'assistantResponse is required', code: 'MISSING_ASSISTANT_RESPONSE' },
        { status: 400 }
      );
    }

    // Initialize memory if needed
    const memory = getMemory({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
    });

    // Auto-save the conversation
    await memory.autoSaveConversation(
      userId,
      userMessage,
      assistantResponse,
      sessionId,
      metadata
    );

    // Get the session ID (either provided or created)
    const activeSession = await memory.getOrCreateActiveSession(userId);

    return NextResponse.json({
      success: true,
      sessionId: activeSession.id,
      message: 'Conversation stored successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Memory Store Conversation API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to store conversation', 
        code: 'STORE_CONVERSATION_ERROR' 
      },
      { status: 500 }
    );
  }
}
