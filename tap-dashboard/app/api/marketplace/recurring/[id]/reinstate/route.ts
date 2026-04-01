/**
 * POST /api/marketplace/recurring/[id]/reinstate — Undo a terminate within 24h.
 * Restores the recurring job and schedules the next run based on original recurrence.
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
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

const RECURRENCE_HOURS: Record<string, number> = {
  hourly: 1, daily: 24, weekly: 168, monthly: 720,
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await sb
    .from('marketplace_jobs')
    .select('id, title, status, recurrence, recurrence_interval, terminated_at')
    .eq('id', params.id)
    .eq('hirer_id', agentId)
    .single()

  if (!job) return NextResponse.json({ error: 'Recurring job not found or you do not own it' }, { status: 404 })
  if (!job.terminated_at) return NextResponse.json({ error: 'Job is not terminated — nothing to reinstate' }, { status: 409 })
  if (job.status !== 'cancelled') return NextResponse.json({ error: 'Only cancelled jobs can be reinstated' }, { status: 409 })

  // Check 24h window
  const terminatedAt = new Date(job.terminated_at)
  const msElapsed = Date.now() - terminatedAt.getTime()
  if (msElapsed > 24 * 60 * 60 * 1000) {
    return NextResponse.json({
      error: 'Reinstate window expired — jobs can only be reinstated within 24 hours of termination.',
      terminated_at: job.terminated_at,
      window_closed_at: new Date(terminatedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }, { status: 410 })
  }

  // Recalculate next run
  const intervalHours = RECURRENCE_HOURS[job.recurrence] ?? job.recurrence_interval ?? 24
  const nextRun = new Date(Date.now() + intervalHours * 60 * 60 * 1000)

  await sb
    .from('marketplace_jobs')
    .update({
      status: 'open',
      terminated_at: null,
      next_run_at: nextRun.toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json({
    success: true,
    job_id: params.id,
    title: job.title,
    recurrence: job.recurrence,
    next_run_at: nextRun.toISOString(),
    message: `Recurring job reinstated. Next run: ${nextRun.toLocaleString()} (${job.recurrence}).`,
  })
}
