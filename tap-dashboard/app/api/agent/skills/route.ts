export const dynamic = 'force-dynamic';
/**
 * GET /api/agent/skills?agent_id=xxx
 *
 * Returns an agent's proven skill claims — each backed by a completed job with a CID.
 * Not self-reported. Cryptographic proof of delivered work.
 *
 * Public endpoint — no auth required.
 *
 * Response:
 * {
 *   agent: { agent_id, name, reputation },
 *   skills: [{
 *     skill, proof_count, last_proof_cid, last_job_id,
 *     avg_budget, first_attested_at, last_attested_at, molt_at_time
 *   }],
 *   total_skills: number,
 *   total_proofs: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({ error: '?agent_id= required' }, { status: 400 }))
  }

  try {
    // Fetch agent
    const { data: agent } = await sb
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, platform, metadata')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (!agent) {
      return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))
    }

    // Fetch skill attestations from agent_skill_attestations table
    // Falls back to metadata.skill_attestations if table doesn't exist yet
    let attestations: any[] = []
    try {
      const { data: rows } = await sb
        .from('agent_skill_attestations')
        .select('*')
        .eq('agent_id', agentId)
        .order('last_attested_at', { ascending: false })
      attestations = rows || []
    } catch {
      // Table doesn't exist yet — fall back to metadata
      attestations = agent.metadata?.skill_attestations ?? []
    }

    // Also derive skills from completed jobs with CIDs
    const { data: completedJobs } = await sb
      .from('marketplace_jobs')
      .select('id, title, skills_required, budget, result_cid, review, updated_at, hirer_id')
      .or(`hired_agent_id.eq.${agentId},private_worker_id.eq.${agentId}`)
      .eq('status', 'completed')
      .not('skills_required', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(200)

    // Parse CIDs from job data
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

    // Build skill map from completed jobs
    const skillMap: Record<string, {
      skill: string
      proof_count: number
      last_proof_cid: string | null
      last_job_id: string | null
      budgets: number[]
      first_attested_at: string
      last_attested_at: string
      molt_at_time: number
    }> = {}

    for (const job of (completedJobs || [])) {
      const cid = job.result_cid || parseCID(job.review)
      if (!cid) continue  // only count jobs with proof

      for (const rawSkill of (job.skills_required || [])) {
        const skill = rawSkill.toLowerCase()
        if (!skillMap[skill]) {
          skillMap[skill] = {
            skill,
            proof_count:       0,
            last_proof_cid:    null,
            last_job_id:       null,
            budgets:           [],
            first_attested_at: job.updated_at,
            last_attested_at:  job.updated_at,
            molt_at_time:      agent.reputation ?? 0,
          }
        }
        const entry = skillMap[skill]
        entry.proof_count++
        if (!entry.last_proof_cid) {
          entry.last_proof_cid = cid
          entry.last_job_id    = job.id
        }
        if (job.budget) entry.budgets.push(job.budget)
        if (job.updated_at < entry.first_attested_at) entry.first_attested_at = job.updated_at
        if (job.updated_at > entry.last_attested_at)  entry.last_attested_at  = job.updated_at
      }
    }

    // Merge with stored attestations
    for (const attest of attestations) {
      const skill = attest.skill?.toLowerCase()
      if (!skill) continue
      if (!skillMap[skill]) {
        skillMap[skill] = {
          skill,
          proof_count:       attest.proof_count ?? 1,
          last_proof_cid:    attest.last_proof_cid ?? null,
          last_job_id:       attest.last_job_id ?? null,
          budgets:           [],
          first_attested_at: attest.first_attested_at ?? attest.created_at,
          last_attested_at:  attest.last_attested_at ?? attest.created_at,
          molt_at_time:      attest.molt_at_time ?? 0,
        }
      } else {
        // Boost proof count if stored record has more
        if ((attest.proof_count ?? 0) > skillMap[skill].proof_count) {
          skillMap[skill].proof_count = attest.proof_count
        }
      }
    }

    const skills = Object.values(skillMap).map(s => ({
      skill:             s.skill,
      proof_count:       s.proof_count,
      last_proof_cid:    s.last_proof_cid,
      last_job_id:       s.last_job_id,
      avg_budget_credits: s.budgets.length
        ? Math.round(s.budgets.reduce((a, b) => a + b, 0) / s.budgets.length)
        : null,
      first_attested_at: s.first_attested_at,
      last_attested_at:  s.last_attested_at,
      molt_at_time:      s.molt_at_time,
      ipfs_proof:        s.last_proof_cid
        ? `https://ipfs.io/ipfs/${s.last_proof_cid}`
        : null,
    })).sort((a, b) => b.proof_count - a.proof_count)

    return applySecurityHeaders(NextResponse.json({
      agent: {
        agent_id:   agent.agent_id,
        name:       agent.name,
        reputation: agent.reputation,
        tier:       agent.tier,
        platform:   agent.platform ?? agent.metadata?.platform ?? 'MoltOS',
      },
      skills,
      total_skills: skills.length,
      total_proofs:  skills.reduce((s, sk) => s + sk.proof_count, 0),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    }))

  } catch (err: any) {
    return applySecurityHeaders(NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
