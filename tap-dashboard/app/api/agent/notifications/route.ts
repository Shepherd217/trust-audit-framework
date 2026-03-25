/**
 * GET /api/agent/notifications
 * Returns notifications for the authenticated agent
 * Auth: X-API-Key or Bearer token
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '@/lib/security';
import { createHash } from 'crypto';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  return createClient(url, key);
}

async function resolveAgentId(apiKey: string): Promise<string | null> {
  const supabase = getSupabase();
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  const { data } = await (supabase as any)
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', apiKeyHash)
    .single();
  return data?.agent_id || null;
}

export async function GET(request: NextRequest) {
  try {
    // Get API key from header (X-API-Key or Bearer)
    const xApiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');
    const apiKey = xApiKey || authHeader?.replace('Bearer ', '');

    if (!apiKey) {
      return applySecurityHeaders(NextResponse.json({ error: 'Missing API key' }, { status: 401 }));
    }

    const agentId = await resolveAgentId(apiKey);
    if (!agentId) {
      return applySecurityHeaders(NextResponse.json({ error: 'Invalid API key' }, { status: 401 }));
    }

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    // Pull from dispute_cases, appeals, and attestations as notification sources
    const [disputes, appeals] = await Promise.all([
      (supabase as any)
        .from('dispute_cases')
        .select('id, status, created_at, respondent_id, claimant_id')
        .or(`claimant_id.eq.${agentId},respondent_id.eq.${agentId}`)
        .order('created_at', { ascending: false })
        .limit(10),
      (supabase as any)
        .from('appeals')
        .select('id, status, created_at, appellant_id')
        .eq('appellant_id', agentId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const notifications = [
      ...(disputes.data || []).map((d: any) => ({
        id: d.id,
        type: 'dispute',
        title: 'Dispute Case',
        message: `Dispute ${d.id.slice(0, 8)} — status: ${d.status}`,
        read_at: d.status === 'resolved' ? d.created_at : null,
        created_at: d.created_at,
      })),
      ...(appeals.data || []).map((a: any) => ({
        id: a.id,
        type: 'appeal',
        title: 'Appeal Update',
        message: `Appeal ${a.id.slice(0, 8)} — status: ${a.status}`,
        read_at: a.status === 'resolved' ? a.created_at : null,
        created_at: a.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const filtered = unreadOnly ? notifications.filter(n => !n.read_at) : notifications;

    return applySecurityHeaders(NextResponse.json({
      notifications: filtered,
      total: filtered.length,
      agent_id: agentId,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    }));

  } catch (err) {
    console.error('[notifications]', err);
    return applySecurityHeaders(NextResponse.json({ notifications: [], total: 0 }, { status: 200 }));
  }
}
