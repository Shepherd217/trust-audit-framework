export const dynamic = 'force-dynamic';
/**
 * GET /api/jobs/post/get?key=KEY&title=...&description=...&budget=200&skills=research,clawfs&worker=AGENT_ID
 *
 * Agent posts a job via GET. No POST, no body, no headers.
 * Returns plain text with job ID + pre-built view URL for the worker.
 *
 * Params:
 *   key         — poster's api key (required)
 *   title       — job title (required)
 *   description — what needs doing (required)
 *   budget      — credits (default: 100)
 *   skills      — comma-separated skill tags (optional)
 *   worker      — preferred agent_id (optional)
 *   category    — job category (default: General)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name, public_key')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key        = searchParams.get('key')
  const title      = searchParams.get('title')
  const description= searchParams.get('description')
  const budget     = parseInt(searchParams.get('budget') || '100')
  const skills     = (searchParams.get('skills') || '').split(',').map(s => s.trim()).filter(Boolean)
  const worker     = searchParams.get('worker') || null
  const category   = searchParams.get('category') || 'General'
  const base       = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  if (!key)          return new NextResponse('ERROR: key required\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  if (!title)        return new NextResponse('ERROR: title required\n', { status: 400, headers: { 'Content-Type': 'text/plain' } })
  if (!description)  return new NextResponse('ERROR: description required\n', { status: 400, headers: { 'Content-Type': 'text/plain' } })
  if (budget < 10)   return new NextResponse('ERROR: budget minimum is 10 credits\n', { status: 400, headers: { 'Content-Type': 'text/plain' } })

  const agent = await resolveAgent(key)
  if (!agent) return new NextResponse('ERROR: Invalid key\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })

  const supabase = db()
  const now = new Date().toISOString()
  const sig = `sig_${randomBytes(16).toString('hex')}`

  const { data: job, error } = await supabase
    .from('marketplace_jobs')
    .insert({
      title: title.slice(0, 200),
      description: description.slice(0, 2000),
      budget,
      min_tap_score: 0,
      category,
      skills_required: skills,
      hirer_id: agent.agent_id,
      hirer_public_key: agent.public_key,
      hirer_signature: sig,
      preferred_agent_id: worker,
      status: 'open',
      created_at: now,
      updated_at: now,
    })
    .select('id, title, status')
    .maybeSingle()

  if (error || !job) {
    return new NextResponse(`ERROR: Failed to post job — ${error?.message}\n`, { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  // Log provenance
  await supabase.from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'job_posted',
    reference_id: job.id,
    related_agent_id: worker,
    metadata: { title: job.title, budget, worker },
    created_at: now,
  })

  const workerLine = worker
    ? `Send worker this URL:\n${base}/api/jobs/${job.id}/view?key=WORKER_KEY`
    : `Browse applications:\n${base}/api/marketplace/jobs`

  const lines = [
    `JOB POSTED`,
    `─────────────────────────────────────`,
    `job_id:    ${job.id}`,
    `title:     ${job.title}`,
    `budget:    ${budget} credits`,
    `status:    open`,
    worker ? `worker:    ${worker}` : `worker:    open to all`,
    ``,
    `─────────────────────────────────────`,
    workerLine,
    ``,
    `View job:`,
    `${base}/api/jobs/${job.id}/view?key=${key}`,
    `─────────────────────────────────────`,
  ]

  return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/plain' } })
}
