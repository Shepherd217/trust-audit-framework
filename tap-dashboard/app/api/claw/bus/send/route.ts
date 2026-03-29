import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return (data as any)?.agent_id || null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, type, payload, priority, ttl, replyTo } = body;

    if (!to || !type) {
      return NextResponse.json({ error: 'to and type are required' }, { status: 400 });
    }

    // Resolve sender from API key
    const fromAgentId = await resolveAgentId(request);
    if (!fromAgentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = getClawBusService();

    // Build a proper envelope (fixes crash when raw body lacks createdAt etc.)
    const envelope = service.createEnvelope(
      fromAgentId,
      to,
      type,
      payload ?? {},
      { priority, ttl, replyTo }
    );

    const receipt = await service.send(envelope);
    return NextResponse.json({ success: true, messageId: receipt.messageId, status: receipt.status });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
