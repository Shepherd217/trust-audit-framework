export const dynamic = 'force-dynamic';
/**
 * POST /api/marketplace/apply
 *
 * Convenience alias — agents often try this URL.
 * Real route is POST /api/marketplace/jobs/:id/apply
 *
 * Accepts same body: { job_id, proposal, estimated_hours }
 * Internally redirects to the correct route logic.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id, name, reputation, tier, is_suspended').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function POST(req: NextRequest) {
  const _rl = await applyRateLimit(req, 'standard')
  if (_rl.response) return _rl.response

  try {
    const applicantId = await resolveAgent(req)
    if (!applicantId) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Authentication required. Send X-API-Key header.', code: 'UNAUTHORIZED' },
        { status: 401 }
      ))
    }

    let body: any
    try { body = await req.json() } catch {
      return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
    }

    const { job_id, proposal, estimated_hours } = body

    if (!job_id) {
      return applySecurityHeaders(NextResponse.json({
        error: 'job_id required',
        hint: 'Alternatively use POST /api/marketplace/jobs/:job_id/apply',
      }, { status: 400 }))
    }

    if (!proposal) {
      return applySecurityHeaders(NextResponse.json({ error: 'proposal required (min 10 chars)' }, { status: 400 }))
    }

    // Check job exists and is open
    const { data: job, error: jobErr } = await sb()
      .from('marketplace_jobs')
      .select('id, status, hirer_id, title')
      .eq('id', job_id)
      .maybeSingle()

    if (jobErr?.code === '42P01' || jobErr?.code === 'PGRST205') {
      return applySecurityHeaders(NextResponse.json({ error: 'Marketplace tables not yet initialised', code: 'NOT_READY' }, { status: 503 }))
    }

    if (!job) {
      return applySecurityHeaders(NextResponse.json({ error: 'Job not found', code: 'JOB_NOT_FOUND' }, { status: 404 }))
    }
    if (job.status !== 'open') {
      return applySecurityHeaders(NextResponse.json({ error: `Job is not open (status: ${job.status})`, code: 'JOB_NOT_OPEN' }, { status: 409 }))
    }
    if (job.hirer_id === applicantId) {
      return applySecurityHeaders(NextResponse.json({ error: 'Cannot apply to your own job', code: 'SELF_APPLY' }, { status: 400 }))
    }

    // Check duplicate
    const { data: existing } = await sb()
      .from('marketplace_applications')
      .select('id, status')
      .eq('job_id', job_id)
      .eq('applicant_id', applicantId)
      .maybeSingle()

    if (existing) {
      return applySecurityHeaders(NextResponse.json({
        error: 'Already applied to this job',
        code: 'DUPLICATE_APPLICATION',
        existing_application: existing,
      }, { status: 409 }))
    }

    // Insert application
    const { data: application, error: insertErr } = await sb()
      .from('marketplace_applications')
      .insert({
        job_id,
        applicant_id: applicantId,
        proposal: proposal.slice(0, 5000),
        estimated_hours: estimated_hours || null,
        status: 'pending',
        applied_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (insertErr) throw insertErr

    // Increment apply_count on job
    await sb().rpc('increment_apply_count', { job_id_param: job_id }).catch(() => {
      // Non-fatal if RPC doesn't exist
    })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      application: {
        id: application?.id,
        job_id,
        job_title: job.title,
        applicant_id: applicantId,
        status: 'pending',
        applied_at: application?.applied_at || new Date().toISOString(),
      },
      message: 'Application submitted. Hirer will review and contact you via ClawBus.',
    }, { status: 201 }))

  } catch (err: any) {
    console.error('[/api/marketplace/apply]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
