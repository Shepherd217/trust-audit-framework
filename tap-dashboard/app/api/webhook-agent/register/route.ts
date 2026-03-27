import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).single()
  return data || null
}

// POST /api/webhook-agent/register
// Register a URL endpoint as an agent. MoltOS will POST matching jobs to it.
export async function POST(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { endpoint_url, capabilities, min_budget, max_concurrent, timeout_seconds } = body

  if (!endpoint_url) return NextResponse.json({ error: 'endpoint_url required' }, { status: 400 })

  // Validate URL
  try { new URL(endpoint_url) } catch {
    return NextResponse.json({ error: 'Invalid endpoint_url' }, { status: 400 })
  }

  // Generate HMAC secret for payload verification
  const webhookSecret = `whs_${randomBytes(32).toString('hex')}`

  // Ping the endpoint to verify it's reachable
  let pingStatus = 'unverified'
  try {
    const pingRes = await fetch(endpoint_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MoltOS-Event': 'ping', 'X-MoltOS-Agent': agent.agent_id },
      body: JSON.stringify({ event: 'ping', agent_id: agent.agent_id, timestamp: Date.now() }),
      signal: AbortSignal.timeout(5000),
    })
    pingStatus = pingRes.ok ? 'verified' : 'unreachable'
  } catch {
    pingStatus = 'unreachable'
  }

  // Upsert webhook agent record
  const { data: webhook, error } = await (supabase as any)
    .from('webhook_agents')
    .upsert({
      agent_id: agent.agent_id,
      endpoint_url,
      secret: webhookSecret,
      capabilities: capabilities || [],
      min_budget: min_budget || 0,
      max_concurrent: max_concurrent || 5,
      timeout_seconds: timeout_seconds || 300,
      status: pingStatus === 'verified' ? 'active' : 'pending_verification',
      last_pinged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    webhook_id: webhook.id,
    agent_id: agent.agent_id,
    endpoint_url,
    webhook_secret: webhookSecret,
    capabilities: capabilities || [],
    ping_status: pingStatus,
    status: webhook.status,
    message: pingStatus === 'verified'
      ? 'Webhook registered and verified. Jobs matching your capabilities will be POSTed to your endpoint.'
      : 'Webhook registered. Endpoint unreachable at registration time — ensure it responds to POST requests.',
    payload_format: {
      event: 'job.assigned',
      job_id: 'uuid',
      title: 'string',
      description: 'string',
      budget_credits: 'number',
      deadline_seconds: 'number',
      clawfs_output_path: 'string — write your result here',
    },
    verification: 'All payloads signed with X-MoltOS-Signature (HMAC-SHA256). Verify with your webhook_secret.',
  })
}

// GET /api/webhook-agent/register — get current webhook config
export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: webhook } = await (supabase as any)
    .from('webhook_agents')
    .select('id, endpoint_url, capabilities, status, jobs_completed, error_count, last_pinged_at, created_at')
    .eq('agent_id', agent.agent_id)
    .single()

  if (!webhook) return NextResponse.json({ error: 'No webhook registered' }, { status: 404 })

  return NextResponse.json(webhook)
}
