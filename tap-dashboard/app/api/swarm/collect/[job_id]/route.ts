export const dynamic = 'force-dynamic';
/**
 * GET /api/swarm/collect/:job_id
 *
 * Collect results from all child jobs of a swarm decomposition.
 * Lead agent calls this to check if all subtasks are complete before delivering to hirer.
 *
 * Auth: Bearer token of the lead agent
 *
 * Response:
 * {
 *   parent_job_id,
 *   status: 'pending' | 'partial' | 'complete',
 *   child_jobs: [{ id, title, status, result_cid, worker_id }],
 *   complete_count, pending_count, total,
 *   all_cids: string[],
 *   ready_to_deliver: bool
 * }
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
  const { data } = await getSupabase()
    .from('agent_registry')
    .select('agent_id, name')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

function parseCID(review?: string | null): string | null {
  if (!review) return null
  try { return JSON.parse(review).result_cid || null } catch { return null }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const sb = getSupabase()
  const lead = await resolveAgent(req)
  if (!lead) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { job_id } = await params

  // Get parent job and its manifest
  const { data: parentJob } = await sb
    .from('marketplace_jobs')
    .select('id, title, budget, hirer_id, hired_agent_id, private_worker_id, hirer_signature, status')
    .eq('id', job_id)
    .maybeSingle()

  if (!parentJob) return applySecurityHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }))

  const isLead = parentJob.hired_agent_id === lead.agent_id ||
                 parentJob.private_worker_id === lead.agent_id ||
                 parentJob.hirer_id === lead.agent_id

  if (!isLead) return applySecurityHeaders(NextResponse.json({ error: 'Not your swarm job' }, { status: 403 }))

  // Parse manifest from hirer_signature
  let manifest: any = null
  try { manifest = JSON.parse(parentJob.hirer_signature || '{}') } catch {} // intentional

  const childJobIds: string[] = manifest?.manifest?.child_job_ids ?? []

  if (!childJobIds.length) {
    return applySecurityHeaders(NextResponse.json({
      parent_job_id: job_id,
      status: 'no_subtasks',
      message: 'No swarm decomposition found for this job. Run POST /api/swarm/decompose/:job_id first.',
    }))
  }

  // Fetch child job statuses
  const { data: childJobs } = await sb
    .from('marketplace_jobs')
    .select('id, title, status, result_cid, review, hired_agent_id, private_worker_id, budget, skills_required')
    .in('id', childJobIds)

  const children = (childJobs || []).map((j: any) => ({
    id:         j.id,
    title:      j.title,
    status:     j.status,
    result_cid: j.result_cid || parseCID(j.review),
    worker_id:  j.hired_agent_id || j.private_worker_id || null,
    budget:     j.budget,
    skills:     j.skills_required,
  }))

  const completeCount = children.filter((c: any) => c.status === 'completed' && c.result_cid).length
  const pendingCount  = children.filter((c: any) => c.status !== 'completed').length
  const allCids       = children.map((c: any) => c.result_cid).filter(Boolean)
  const readyToDeliver = completeCount === children.length && children.length > 0

  const swarmStatus = readyToDeliver ? 'complete' : completeCount > 0 ? 'partial' : 'pending'

  return applySecurityHeaders(NextResponse.json({
    parent_job_id:    job_id,
    status:           swarmStatus,
    child_jobs:       children,
    complete_count:   completeCount,
    pending_count:    pendingCount,
    total:            children.length,
    all_cids:         allCids,
    ready_to_deliver: readyToDeliver,
    next_step: readyToDeliver
      ? `All ${completeCount} subtasks complete. Call POST /api/marketplace/jobs/${job_id}/complete with result_cid (your merged CID) to deliver to hirer.`
      : `${pendingCount} subtask(s) still pending. Poll again or check /marketplace for open sub-jobs.`,
  }))
}
