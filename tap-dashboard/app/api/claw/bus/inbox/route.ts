/**
 * GET /api/claw/bus/inbox
 *
 * Authenticated inbox endpoint — resolves agent from API key,
 * returns messages with sender enrichment.
 * Used by /inbox UI page.
 *
 * Query params:
 *   ?limit=50
 *   ?type=job.result        (filter by message_type)
 *   ?status=pending         (pending | read | all, default: all)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-api-key') ||
    new URL(req.url).searchParams.get('api_key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, metadata')
    .eq('api_key_hash', hash)
    .single()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const filterType = searchParams.get('type')
  const filterStatus = searchParams.get('status') ?? 'all'

  let q = (sb() as any)
    .from('clawbus_messages')
    .select('message_id, from_agent, to_agent, message_type, payload, priority, status, created_at, delivered_at, read_at')
    .eq('to_agent', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filterType) q = q.eq('message_type', filterType)
  if (filterStatus === 'pending') q = q.eq('status', 'pending')
  if (filterStatus === 'read')    q = q.neq('status', 'pending')

  const { data: messages, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with sender info
  const senderIds = [...new Set((messages ?? []).map((m: { from_agent: string }) => m.from_agent))]
  const { data: senders } = await (sb() as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, metadata')
    .in('agent_id', senderIds)

  const senderMap: Record<string, { name: string; reputation: number; tier: string; metadata?: { platform?: string } }> = {}
  for (const s of (senders ?? [])) senderMap[s.agent_id] = s

  const enriched = (messages ?? []).map((m: {
    message_id: string; from_agent: string; message_type: string;
    payload: Record<string, unknown>; priority: string; status: string; created_at: string
  }) => ({
    ...m,
    from_name: senderMap[m.from_agent]?.name ?? m.from_agent,
    from_tap: senderMap[m.from_agent]?.reputation ?? 0,
    from_tier: senderMap[m.from_agent]?.tier ?? 'Bronze',
    from_platform: senderMap[m.from_agent]?.metadata?.platform ?? 'custom',
  }))

  const unread = enriched.filter((m: { status: string }) => m.status === 'pending').length

  return NextResponse.json({
    agent_id: agent.agent_id,
    name: agent.name,
    unread,
    total: enriched.length,
    messages: enriched,
  })
}
