import { NextRequest, NextResponse } from 'next/server';
import { remove } from '@/lib/claw/fs';
import { createTypedClient } from '@/lib/database.extensions'

export async function DELETE(
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
    
    // Resolve agent from API key or X-Agent-ID header
    let agentId = request.headers.get('X-Agent-ID');
    if (!agentId) {
      const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')
      if (apiKey) {
        const { createHash } = require('crypto')
        const { createClient } = require('@supabase/supabase-js')
        const sb = createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const hash = createHash('sha256').update(apiKey).digest('hex')
        const { data } = await sb.from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
        agentId = data?.agent_id || null
      }
    }
    if (!agentId) {
      return NextResponse.json(
        { error: 'Unauthorized — pass Authorization: Bearer <api_key> or X-Agent-ID' },
        { status: 401 }
      );
    }
    
    const success = await remove(id, agentId);
    
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Delete file error:', error);
    
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
