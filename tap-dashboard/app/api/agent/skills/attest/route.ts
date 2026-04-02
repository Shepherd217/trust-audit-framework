export const dynamic = 'force-dynamic';
/**
 * POST /api/agent/skills/attest
 *
 * Generate a skill attestation after completing a job with a CID.
 * Stores the claim so it's queryable via GET /api/agent/skills.
 *
 * Auth: Bearer token (the worker agent)
 *
 * Body:
 * {
 *   job_id: string   — the completed job ID
 *   skill: string    — skill to attest (must be in job's skills_required)
 * }
 *
 * The attestation is backed by a CID receipt — not self-reported.
 * Anyone can verify: GET /api/agent/skills?agent_id=xxx
 * and follow the ipfs_proof link.
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
    .select('agent_id, name, reputation, metadata')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

function parseCID(review?: string | null): string | null {
  if (!review) return null
  try {
    const p = JSON.parse(review)
    return p.result_cid || null
  } catch {
    const m = review.match(/CID:\s*(bafy[a-zA-Z0-9]+)/)
    return m ? m[1] : null
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const { job_id, skill } = body

  if (!job_id || !skill) {
    return applySecurityHeaders(NextResponse.json({ error: 'job_id and skill required' }, { status: 400 }))
  }

  // Verify job exists, is completed, and agent was the worker
  const { data: job } = await sb
    .from('marketplace_jobs')
    .select('id, skills_required, status, result_cid, review, budget, updated_at, hired_agent_id, private_worker_id')
    .eq('id', job_id)
    .maybeSingle()

  if (!job) {
    return applySecurityHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }))
  }
  if (job.status !== 'completed') {
    return applySecurityHeaders(NextResponse.json({ error: 'Job must be completed to attest a skill' }, { status: 400 }))
  }

  const wasWorker = job.hired_agent_id === agent.agent_id || job.private_worker_id === agent.agent_id
  if (!wasWorker) {
    return applySecurityHeaders(NextResponse.json({ error: 'You were not the worker on this job' }, { status: 403 }))
  }

  const skillLower = skill.toLowerCase()
  const jobSkills: string[] = (job.skills_required || []).map((s: string) => s.toLowerCase())
  if (!jobSkills.includes(skillLower)) {
    return applySecurityHeaders(NextResponse.json(
      { error: `Skill "${skill}" not in job's skills_required: [${job.skills_required?.join(', ')}]` },
      { status: 400 }
    ))
  }

  // Get CID proof
  const cid = job.result_cid || parseCID(job.review)
  if (!cid) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'No CID found on this job. Skill attestations require a result_cid as proof of delivery. Re-complete the job with result_cid in the body.' },
      { status: 400 }
    ))
  }

  const now = new Date().toISOString()

  // Store attestation — upsert into agent_skill_attestations if table exists
  // otherwise fall back to agent_registry metadata
  let stored = false
  try {
    const { error: upsertErr } = await sb
      .from('agent_skill_attestations')
      .upsert({
        agent_id:          agent.agent_id,
        skill:             skillLower,
        proof_job_id:      job_id,
        proof_cid:         cid,
        molt_at_time:      agent.reputation ?? 0,
        budget:            job.budget ?? 0,
        first_attested_at: now,
        last_attested_at:  now,
        proof_count:       1,
      }, {
        onConflict: 'agent_id,skill',
        ignoreDuplicates: false,
      })
    if (!upsertErr) stored = true
  } catch { /* table doesn't exist — use metadata fallback */ }

  if (!stored) {
    // Metadata fallback
    const existingAttestations: any[] = agent.metadata?.skill_attestations ?? []
    const idx = existingAttestations.findIndex((a: any) => a.skill === skillLower)
    if (idx >= 0) {
      existingAttestations[idx].proof_count = (existingAttestations[idx].proof_count ?? 1) + 1
      existingAttestations[idx].last_attested_at = now
      existingAttestations[idx].last_proof_cid = cid
      existingAttestations[idx].last_job_id = job_id
    } else {
      existingAttestations.push({
        skill:             skillLower,
        proof_job_id:      job_id,
        proof_cid:         cid,
        last_proof_cid:    cid,
        last_job_id:       job_id,
        molt_at_time:      agent.reputation ?? 0,
        first_attested_at: now,
        last_attested_at:  now,
        proof_count:       1,
      })
    }
    await sb
      .from('agent_registry')
      .update({ metadata: { ...agent.metadata, skill_attestations: existingAttestations } })
      .eq('agent_id', agent.agent_id)
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    attestation: {
      agent_id:          agent.agent_id,
      skill:             skillLower,
      proof_job_id:      job_id,
      proof_cid:         cid,
      ipfs_proof:        `https://ipfs.io/ipfs/${cid}`,
      molt_at_time:      agent.reputation ?? 0,
      attested_at:       now,
    },
    message: `Skill "${skillLower}" attested with CID proof. Verifiable at GET /api/agent/skills?agent_id=${agent.agent_id}`,
  }))
}
