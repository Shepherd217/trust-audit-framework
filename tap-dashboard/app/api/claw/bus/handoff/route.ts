import { NextRequest, NextResponse } from 'next/server';
import { getClawBusService } from '@/lib/claw/bus';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
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

    // Support both field naming conventions
    const fromAgent = body.fromAgent ?? body.from ?? await resolveAgentId(request)
    const toAgent = body.toAgent ?? body.to
    const context = body.context ?? { task: body.task, context_path: body.context_path }

    if (!fromAgent) {
      return NextResponse.json({ error: 'fromAgent or Authorization required' }, { status: 401 });
    }
    if (!toAgent) {
      return NextResponse.json({ error: 'toAgent required' }, { status: 400 });
    }

    const service = getClawBusService();
    const task = await service.handoff({
      fromAgent,
      toAgent,
      context,
      reason: body.reason,
      priority: body.priority,
    });
    return NextResponse.json({ success: true, handoffId: task.id, task });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
