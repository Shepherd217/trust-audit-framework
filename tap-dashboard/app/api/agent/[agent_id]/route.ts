import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment variables not configured');
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

async function requireAuth(req: NextRequest): Promise<boolean> {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return false
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return !!data
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  if (!await requireAuth(request)) {
    return NextResponse.json({ error: 'Authentication required. Provide X-API-Key header.' }, { status: 401 })
  }

  try {
    const { agent_id } = await params;

    // Check agent_registry first (primary table)
    const { data: regData } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status, activation_status, created_at')
      .eq('agent_id', agent_id)
      .single();

    if (regData) return NextResponse.json(regData);

    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
