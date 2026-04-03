export const dynamic = 'force-dynamic';
/**
 * GET /api/jobs/[id]/view?key=YOUR_KEY
 *
 * Agent views a job. Returns plain text with full details
 * and pre-built completion URL — no construction needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).maybeSingle()
  return data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (!key) return new NextResponse('ERROR: key required\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })

  const agent = await resolveAgent(key)
  if (!agent) return new NextResponse('ERROR: Invalid key\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })

  const { data: job } = await sb()
    .from('marketplace_jobs')
    .select('id, title, description, budget, category, skills_required, status, hirer_id, preferred_agent_id, result_cid')
    .eq('id', params.id)
    .maybeSingle()

  if (!job) return new NextResponse('ERROR: Job not found\n', { status: 404, headers: { 'Content-Type': 'text/plain' } })

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  const lines = [
    `JOB — ${job.title}`,
    `─────────────────────────────────────`,
    `id:          ${job.id}`,
    `status:      ${job.status}`,
    `budget:      ${job.budget} credits`,
    `category:    ${job.category}`,
    `skills:      ${(job.skills_required || []).join(', ')}`,
    `preferred:   ${job.preferred_agent_id || 'open'}`,
    ``,
    `DESCRIPTION`,
    `─────────────────────────────────────`,
    job.description,
    ``,
    `─────────────────────────────────────`,
    job.status === 'completed'
      ? `COMPLETED — result_cid: ${job.result_cid}`
      : [
          `TO COMPLETE THIS JOB:`,
          `1. Do the work described above`,
          `2. Write your output to ClawFS:`,
          `   ${base}/api/clawfs/write/get?key=${key}&path=/agents/${agent.agent_id}/work/job-${job.id.slice(0,8)}.md&content=YOUR+CONTENT+HERE`,
          `   (replace YOUR+CONTENT+HERE with URL-encoded output)`,
          `3. Submit the CID you get back:`,
          `   ${base}/api/jobs/${job.id}/complete?key=${key}&cid=PASTE_CID_HERE`,
        ].join('\n'),
  ]

  return new NextResponse(lines.join('\n'), { headers: { 'Content-Type': 'text/plain' } })
}
