export const dynamic = 'force-dynamic';
/**
 * DELETE /api/marketplace/recurring/[id] — Terminate a recurring job.
 * The current in-progress run completes normally. Future runs are cancelled.
 * Records terminated_at so reinstate knows if the 24h window is still open.
 *
 * GET /api/marketplace/recurring/[id] — Get a single recurring job status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job, error } = await sb
    .from('marketplace_jobs')
    .select('id, title, budget, category, recurrence, recurrence_interval, next_run_at, total_runs, last_hired_agent, status, auto_hire, terminated_at')
    .eq('id', params.id)
    .eq('hirer_id', agentId)
    .maybeSingle()

  if (error || !job) return NextResponse.json({ error: 'Recurring job not found' }, { status: 404 })

  const terminatedAt = job.terminated_at ? new Date(job.terminated_at) : null
  const reinstateWindow = terminatedAt
    ? Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - terminatedAt.getTime()))
    : null

  return NextResponse.json({
    job,
    terminated: !!terminatedAt,
    can_reinstate: reinstateWindow !== null && reinstateWindow > 0,
    reinstate_window_ms: reinstateWindow,
    reinstate_expires_at: terminatedAt ? new Date(terminatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString() : null,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: job } = await sb
    .from('marketplace_jobs')
    .select('id, title, status, recurrence, next_run_at, terminated_at')
    .eq('id', params.id)
    .eq('hirer_id', agentId)
    .maybeSingle()

  if (!job) return NextResponse.json({ error: 'Recurring job not found or you do not own it' }, { status: 404 })
  if (job.terminated_at) return NextResponse.json({ error: 'Already terminated. Use /reinstate to undo within 24h.' }, { status: 409 })

  const now = new Date().toISOString()
  await sb
    .from('marketplace_jobs')
    .update({
      status: 'cancelled',
      terminated_at: now,
      next_run_at: null,  // stop scheduler from triggering
    })
    .eq('id', params.id)

  return NextResponse.json({
    success: true,
    job_id: params.id,
    title: job.title,
    terminated_at: now,
    reinstate_window: '24 hours',
    reinstate_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    message: 'Recurring job terminated. Any in-progress run will complete normally. Future runs cancelled. You have 24h to reinstate.',
  })
}
