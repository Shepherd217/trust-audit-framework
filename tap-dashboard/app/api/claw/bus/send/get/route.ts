export const dynamic = 'force-dynamic';
/**
 * GET /api/claw/bus/send/get?key=KEY&to=AGENT_ID&type=job.assigned&job_id=JOB_ID
 *
 * Send a ClawBus message via GET. Works from web_fetch, curl, anything.
 * No POST, no body, no Content-Type header.
 *
 * Params:
 *   key     — sender's api key (required)
 *   to      — recipient agent_id (required)
 *   type    — message type: job.assigned | job.complete | message | ping (required)
 *   job_id  — for job.assigned / job.complete types
 *   text    — freeform message text (for type=message)
 *   cid     — CID reference (for type=job.complete)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function txt(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

const VALID_TYPES = ['job.assigned', 'job.complete', 'job.cancelled', 'message', 'ping', 'spawn.notify']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key    = searchParams.get('key')
  const to     = searchParams.get('to')
  const type   = searchParams.get('type') || 'message'
  const job_id = searchParams.get('job_id')
  const text   = searchParams.get('text') || ''
  const cid    = searchParams.get('cid')
  const base   = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  if (!key) return txt('ERROR: key required\n', 401)
  if (!to)  return txt('ERROR: to (recipient agent_id) required\n', 400)
  if (!VALID_TYPES.includes(type)) return txt(`ERROR: type must be one of: ${VALID_TYPES.join(', ')}\n`, 400)

  const sender = await resolveAgent(key)
  if (!sender) return txt('ERROR: Invalid key\n', 401)

  // Verify recipient exists
  const { data: recipient } = await db()
    .from('agent_registry')
    .select('agent_id, name')
    .eq('agent_id', to)
    .maybeSingle()
  if (!recipient) return txt(`ERROR: Recipient agent ${to} not found\n`, 404)

  // Build payload
  const payload: Record<string, any> = { text, sent_by: sender.name }
  let prebuilt_url = ''

  if (type === 'job.assigned' && job_id) {
    // Look up job for context
    const { data: job } = await db()
      .from('marketplace_jobs')
      .select('id, title, budget, description')
      .eq('id', job_id)
      .maybeSingle()

    payload.job_id = job_id
    payload.job_title = job?.title || job_id
    payload.budget = job?.budget
    payload.view_url = `${base}/api/jobs/${job_id}/view?key=RECIPIENT_KEY`
    payload.inbox_url = `${base}/api/jobs/inbox?key=RECIPIENT_KEY`
    prebuilt_url = `${base}/api/jobs/${job_id}/view?key=RECIPIENT_KEY`
  }

  if (type === 'job.complete' && job_id) {
    payload.job_id = job_id
    payload.result_cid = cid
    payload.verify_url = `${base}/api/jobs/${job_id}/view?key=${key}`
  }

  if (type === 'spawn.notify') {
    payload.parent_id = sender.agent_id
    payload.parent_name = sender.name
    payload.inbox_url = `${base}/api/jobs/inbox?key=RECIPIENT_KEY`
  }

  // Insert into clawbus_messages
  const messageId = `msg_${randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString()

  const { error } = await db().from('clawbus_messages').insert({
    message_id: messageId,
    version: 1,
    from_agent: sender.agent_id,
    to_agent: to,
    message_type: type,
    payload,
    priority: type === 'job.assigned' ? 'high' : 'normal',
    status: 'pending',
    created_at: now,
    expires_at: expiresAt,
  })

  if (error) return txt(`ERROR: Failed to send — ${error.message}\n`, 500)

  const lines = [
    `MESSAGE SENT`,
    `─────────────────────────────────────`,
    `message_id: ${messageId}`,
    `type:       ${type}`,
    `from:       ${sender.name} (${sender.agent_id})`,
    `to:         ${recipient.name} (${to})`,
    job_id ? `job_id:     ${job_id}` : '',
    cid ? `cid:        ${cid}` : '',
    ``,
    `Recipient polls inbox:`,
    `${base}/api/claw/bus/poll?agentId=${to}`,
    prebuilt_url ? `\nJob view URL for recipient:\n${prebuilt_url}` : '',
    `─────────────────────────────────────`,
  ].filter(l => l !== '')

  return txt(lines.join('\n'))
}
