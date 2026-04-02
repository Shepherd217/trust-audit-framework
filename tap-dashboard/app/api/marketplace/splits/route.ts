export const dynamic = 'force-dynamic';
/**
 * POST /api/marketplace/splits — Create a revenue split for a job
 * GET  /api/marketplace/splits?job_id= — Get split for a job
 *
 * Split format: [{ agent_id: string, pct: number, role: string }]
 * pct values must sum to 100
 *
 * Used for partnerships like @sparkxu's 50/50 trading swarm.
 * Split executes automatically when job status → completed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const { job_id, splits } = body

  if (!job_id) return applySecurityHeaders(NextResponse.json({ error: 'job_id required' }, { status: 400 }))
  if (!Array.isArray(splits) || splits.length < 2) {
    return applySecurityHeaders(NextResponse.json({ error: 'splits must be an array of at least 2 entries' }, { status: 400 }))
  }

  // Validate splits sum to 100
  const total = splits.reduce((sum: number, s: any) => sum + (s.pct || 0), 0)
  if (total !== 100) {
    return applySecurityHeaders(NextResponse.json({ error: `Split percentages must sum to 100. Got ${total}` }, { status: 400 }))
  }

  // Validate each split entry
  for (const s of splits) {
    if (!s.agent_id || typeof s.pct !== 'number' || s.pct <= 0) {
      return applySecurityHeaders(NextResponse.json({ error: 'Each split needs agent_id and pct > 0' }, { status: 400 }))
    }
  }

  // Verify job exists and agent is the hirer
  const { data: job } = await sb.from('marketplace_jobs').select('id, hirer_id, title, budget, status').eq('id', job_id).maybeSingle()
  if (!job) return applySecurityHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
  if (job.hirer_id !== agent.agent_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'Only the job hirer can set payment splits' }, { status: 403 }))
  }

  // Save split to job_splits table
  const { data: split, error } = await sb.from('job_splits').upsert({
    job_id,
    created_by: agent.agent_id,
    splits,
    status: 'pending',
    created_at: new Date().toISOString(),
  }, { onConflict: 'job_id' }).select().maybeSingle()

  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  // Also store on the job record
  await sb.from('marketplace_jobs').update({ split_payment: splits }).eq('id', job_id)

  return applySecurityHeaders(NextResponse.json({
    success: true,
    split_id: split.id,
    job_id,
    splits,
    total_budget: job.budget,
    breakdown: splits.map((s: any) => ({
      agent_id: s.agent_id,
      role: s.role || 'participant',
      pct: s.pct,
      credits: Math.round((job.budget * s.pct) / 100),
      usd: ((job.budget * s.pct) / 100 / 100).toFixed(2),
    })),
    message: `Split registered. Executes automatically on job completion. ${splits.map((s: any) => `${s.agent_id.slice(0,16)}: ${s.pct}%`).join(' · ')}`,
  }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('job_id')
  if (!jobId) return applySecurityHeaders(NextResponse.json({ error: 'job_id required' }, { status: 400 }))

  const { data: split } = await getSupabase().from('job_splits').select('*').eq('job_id', jobId).maybeSingle()
  if (!split) return applySecurityHeaders(NextResponse.json({ error: 'No split found for this job' }, { status: 404 }))

  return applySecurityHeaders(NextResponse.json(split))
}
