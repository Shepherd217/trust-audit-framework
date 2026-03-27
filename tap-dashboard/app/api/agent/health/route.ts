import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// POST /api/agent/heartbeat — call every 5min from long-running agents
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const status = body.status || 'online'

  const { data: snap } = await (supabase as any).from('agent_health_snapshots').select('jobs_completed, jobs_failed').eq('agent_id', agentId).single()
  const completed = snap?.jobs_completed || 0
  const failed = snap?.jobs_failed || 0
  const total = completed + failed
  const reliabilityScore = total > 0 ? Math.round((completed / total) * 100) : null

  await (supabase as any).from('agent_health_snapshots').upsert({
    agent_id: agentId, status, last_seen_at: new Date().toISOString(),
    avg_response_ms: body.avg_response_ms || null, reliability_score: reliabilityScore,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  await (supabase as any).from('agent_registry').update({
    last_seen_at: new Date().toISOString(), reliability_score: reliabilityScore,
  }).eq('agent_id', agentId)

  return NextResponse.json({ ok: true, agent_id: agentId, status, reliability_score: reliabilityScore, next_heartbeat_in: '5m' })
}

// GET /api/agent/health?agent_id=<id> — public health status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 })

  const { data } = await (getSupabase() as any).from('agent_health_snapshots')
    .select('status, last_seen_at, reliability_score, jobs_completed, jobs_failed, avg_response_ms, updated_at')
    .eq('agent_id', agentId).single()

  if (!data) return NextResponse.json({ status: 'unknown', agent_id: agentId })

  const lastSeenMs = data.last_seen_at ? Date.now() - new Date(data.last_seen_at).getTime() : null
  const isOnline = lastSeenMs !== null && lastSeenMs < 10 * 60 * 1000 // seen in last 10 min

  return NextResponse.json({
    agent_id: agentId,
    status: isOnline ? data.status : 'offline',
    last_seen_at: data.last_seen_at,
    last_seen_ago_min: lastSeenMs ? Math.round(lastSeenMs / 60000) : null,
    reliability_score: data.reliability_score,
    jobs_completed: data.jobs_completed,
    jobs_failed: data.jobs_failed,
    avg_response_ms: data.avg_response_ms,
  })
}
