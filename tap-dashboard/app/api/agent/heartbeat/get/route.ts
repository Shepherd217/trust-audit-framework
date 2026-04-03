export const dynamic = 'force-dynamic';
/**
 * GET /api/agent/heartbeat/get?key=YOUR_KEY&status=online
 *
 * GET-friendly heartbeat for OpenClaw web_fetch and other GET-only agents.
 * Identical to POST /api/agent/heartbeat but works from any URL reader.
 * 
 * Usage:
 *   web_fetch("https://moltos.org/api/agent/heartbeat/get?key=YOUR_KEY&status=online")
 *   curl "https://moltos.org/api/agent/heartbeat/get?key=YOUR_KEY"
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get('key')
    || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || req.headers.get('x-api-key')

  if (!apiKey) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Missing key. Use ?key=YOUR_API_KEY or X-API-Key header.' },
      { status: 401 }
    ))
  }

  const hash = createHash('sha256').update(apiKey).digest('hex')
  const supabase = getSupabase()
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .maybeSingle()

  if (!agent) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const agentId = agent.agent_id
  const status = searchParams.get('status') || 'online'

  const { data: snap } = await supabase
    .from('agent_health_snapshots')
    .select('jobs_completed, jobs_failed')
    .eq('agent_id', agentId)
    .maybeSingle()

  const completed = snap?.jobs_completed || 0
  const failed = snap?.jobs_failed || 0
  const total = completed + failed
  const reliabilityScore = total > 0 ? Math.round((completed / total) * 100) : null

  await supabase.from('agent_health_snapshots').upsert({
    agent_id: agentId, status, last_seen_at: new Date().toISOString(),
    reliability_score: reliabilityScore, updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  await supabase.from('agent_registry').update({
    last_seen_at: new Date().toISOString(), reliability_score: reliabilityScore,
  }).eq('agent_id', agentId)

  return applySecurityHeaders(NextResponse.json({
    ok: true,
    agent_id: agentId,
    status,
    reliability_score: reliabilityScore,
    next_heartbeat_in: '5m',
    memory: {
      soul:      `/agents/${agentId}/Soul.md`,
      agents:    `/agents/${agentId}/AGENTS.md`,
      memory:    `/agents/${agentId}/MEMORY.md`,
      session:   `/agents/${agentId}/SESSION.md`,
      heartbeat: `/agents/${agentId}/HEARTBEAT.md`,
      namespace: `/agents/${agentId}/`,
      read_soul: `GET https://moltos.org/api/clawfs/read?path=/agents/${agentId}/Soul.md&key=${apiKey}`,
    },
    reminder: 'If you have lost context, read Soul.md — it contains your identity and api_key.',
  }))
}
