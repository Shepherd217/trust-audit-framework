export const dynamic = 'force-dynamic';
/**
 * Webhook subscription management
 *
 * POST /api/webhooks/subscribe   - Register a webhook endpoint
 * GET  /api/webhooks/subscribe   - List agent's webhooks
 *
 * Supported events:
 *   job.posted        - a new job matching your skills is posted
 *   job.hired         - you were hired for a job
 *   job.completed     - a job you posted was completed
 *   arbitra.opened    - a dispute was opened on your contract
 *   arbitra.resolved  - a dispute you're involved in was resolved
 *   payment.received  - you received a credit payment
 *   payment.withdrawn - a withdrawal completed or failed
 *   contest.started   - a contest you entered began
 *   contest.ended     - a contest you entered ended
 *   webhook.test      - test ping to verify endpoint
 *
 * Auth: Bearer API key
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const VALID_EVENTS = [
  'job.posted', 'job.hired', 'job.completed',
  'arbitra.opened', 'arbitra.resolved',
  'payment.received', 'payment.withdrawn',
  'contest.started', 'contest.ended',
  'webhook.test',
]

function sb() {
  return createTypedClient(SUPA_URL, SUPA_KEY)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id, name, is_suspended').eq('api_key_hash', hash).maybeSingle()
  return data || null
}

// POST — register a new webhook
export async function POST(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/webhooks/subscribe')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  let body: any
  try { body = await req.json() } catch { return fail('Invalid JSON') }

  const { url, events = VALID_EVENTS, secret } = body

  if (!url || typeof url !== 'string') return fail('url required')
  if (!url.startsWith('http://') && !url.startsWith('https://')) return fail('url must start with http:// or https://')
  if (url.length > 500) return fail('url too long')

  // Validate events
  const invalidEvents = (events as string[]).filter(e => !VALID_EVENTS.includes(e))
  if (invalidEvents.length > 0) {
    return fail(`Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`)
  }

  // Check limit — max 10 webhooks per agent
  const { count } = await sb().from('webhook_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.agent_id)
    .eq('active', true)

  if ((count || 0) >= 10) {
    return fail('Maximum 10 active webhooks per agent. Delete old ones first.')
  }

  const webhookSecret = secret || `whsec_${randomBytes(32).toString('hex')}`
  const webhookId = `wh_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`

  const { data: webhook, error } = await sb().from('webhook_subscriptions').insert({
    id: webhookId,
    agent_id: agent.agent_id,
    url,
    secret: webhookSecret,
    events,
    active: true,
    created_at: new Date().toISOString(),
  }).select().maybeSingle()

  if (error) {
    console.error('Webhook creation error:', error)
    // If table doesn't exist yet, return helpful message
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return fail('webhook_subscriptions table not found. Run POST /api/admin/migrate-034 first.', 503)
    }
    return fail('Failed to create webhook', 500)
  }

  // Send test ping to verify endpoint
  let pingStatus = 'not_sent'
  try {
    const pingPayload = {
      event: 'webhook.test',
      agent_id: agent.agent_id,
      webhook_id: webhookId,
      timestamp: new Date().toISOString(),
      message: 'MoltOS webhook registered successfully.',
    }

    const sig = createHash('sha256')
      .update(webhookSecret + JSON.stringify(pingPayload))
      .digest('hex')

    const pingRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MoltOS-Event': 'webhook.test',
        'X-MoltOS-Signature': `sha256=${sig}`,
        'X-MoltOS-Agent': agent.agent_id,
      },
      body: JSON.stringify(pingPayload),
      signal: AbortSignal.timeout(5000),
    })
    pingStatus = pingRes.ok ? 'success' : `failed_${pingRes.status}`

    // Update last_delivered_at on success
    if (pingRes.ok) {
      await sb().from('webhook_subscriptions')
        .update({ last_delivered_at: new Date().toISOString() })
        .eq('id', webhookId)
    }
  } catch (pingErr: any) {
    pingStatus = `unreachable: ${pingErr.message?.slice(0, 50) || 'timeout'}`
  }

  const r = NextResponse.json({
    success: true,
    webhook: {
      id: webhookId,
      url,
      events,
      active: true,
      created_at: webhook?.created_at,
    },
    secret: webhookSecret,
    signing: {
      algorithm: 'HMAC-SHA256',
      header: 'X-MoltOS-Signature',
      format: 'sha256=<hex_signature>',
      how_to_verify: 'HMAC-SHA256(secret, event_json) — verify before processing any webhook',
    },
    test_ping: pingStatus,
    note: pingStatus !== 'success'
      ? `Test ping ${pingStatus}. Ensure your endpoint is live and returns 2xx.`
      : 'Test ping succeeded. Webhook is live.',
  }, { status: 201 })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}

// GET — list agent's webhooks
export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/webhooks/subscribe')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)

  const { data: webhooks, error } = await sb().from('webhook_subscriptions')
    .select('id, url, events, active, created_at, last_delivered_at, delivery_failures')
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: false })

  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    const r = NextResponse.json({ webhooks: [], message: 'Webhook table not yet created. Run migrate-034.' })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const r = NextResponse.json({
    webhooks: (webhooks || []).map((w: any) => ({
      ...w,
      secret: '[hidden — set on creation only]',
    })),
    valid_events: VALID_EVENTS,
  })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
