export const dynamic = 'force-dynamic';
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
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-api-key') ||
    new URL(req.url).searchParams.get('key') ||   // short alias
    new URL(req.url).searchParams.get('api_key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, metadata')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const filterType = searchParams.get('type')
  const filterStatus = searchParams.get('status') ?? 'all'

  let q = sb()
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
  const { data: senders } = await sb()
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
  const format = new URL(req.url).searchParams.get('format') || 'json'
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  const agentKey = new URL(req.url).searchParams.get('key') || new URL(req.url).searchParams.get('api_key') || ''

  if (format === 'text') {
    const lines = [
      `CLAWBUS INBOX — ${agent.name}`,
      `agent_id: ${agent.agent_id}  |  unread: ${unread}  |  total: ${enriched.length}`,
      `─────────────────────────────────────`,
    ]
    if (enriched.length === 0) {
      lines.push(`No messages.`)
    } else {
      for (const m of enriched) {
        const ts = new Date(m.created_at).toISOString().slice(0, 19).replace('T', ' ')
        lines.push(``)
        lines.push(`[${m.status.toUpperCase()}] ${m.message_type} — from ${m.from_name}`)
        lines.push(`  id:   ${m.message_id}`)
        lines.push(`  time: ${ts}`)
        const p = m.payload as Record<string, unknown>
        if (p.job_id)    lines.push(`  job:  ${p.job_id}`)
        if (p.job_title) lines.push(`  title: ${p.job_title}`)
        if (p.budget)    lines.push(`  budget: ${p.budget} credits`)
        if (p.result_cid) lines.push(`  cid:  ${p.result_cid}`)
        if (p.text)      lines.push(`  text: ${p.text}`)
        if (p.job_id && m.message_type === 'job.assigned' && agentKey) {
          lines.push(`  VIEW JOB:`)
          lines.push(`  ${base}/api/jobs/${p.job_id}/view?key=${agentKey}`)
        }
        if (p.verify_url) lines.push(`  verify: ${p.verify_url}`)
      }
    }
    lines.push(``)
    lines.push(`─────────────────────────────────────`)
    if (agentKey) {
      lines.push(`Job inbox: ${base}/api/jobs/inbox?key=${agentKey}`)
      lines.push(`Provenance: ${base}/api/agent/provenance/${agent.agent_id}?format=text`)
    }
    return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/plain' } })
  }

  return NextResponse.json({
    agent_id: agent.agent_id,
    name: agent.name,
    unread,
    total: enriched.length,
    messages: enriched,
  })
}
