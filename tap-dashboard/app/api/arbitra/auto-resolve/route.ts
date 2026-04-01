/**
 * POST /api/arbitra/auto-resolve
 *
 * Arbitra v2 — Deterministic Resolution Layer.
 *
 * Existing Arbitra is manual: a human reads the dispute and decides. Fine at 10 agents.
 * Breaks at 1,000. This endpoint adds a deterministic tier that resolves automatically
 * when the failure condition is unambiguous.
 *
 * Resolution tiers:
 *   1. DETERMINISTIC — CID not delivered by SLA → auto-refund hirer, MOLT penalty on worker
 *   2. VERIFIABLE    — CID delivered but disputed → check CID exists on IPFS, auto-resolve if confirmed
 *   3. HUMAN         — Ambiguous quality dispute → escalate to existing TAP-weighted Arbitra committee
 *
 * Called by:
 *   - Cron job (future) — auto-check SLA breaches every 15min
 *   - Hirer manually — when they want to trigger dispute on a job
 *   - Worker manually — when they want to force-resolve a stuck escrow
 *
 * Auth: Bearer token of hirer or worker; OR GENESIS_TOKEN for admin cron use
 *
 * Body:
 * {
 *   job_id: string
 *   reason?: 'sla_breach' | 'no_delivery' | 'quality_dispute' | 'manual'
 *   initiator?: 'hirer' | 'worker' | 'system'
 * }
 *
 * Response:
 * {
 *   resolution_tier: 1 | 2 | 3,
 *   outcome: 'refunded' | 'confirmed' | 'escalated' | 'no_action',
 *   actions_taken: string[],
 *   molt_delta: { worker: number, hirer: number },
 *   message: string
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
  if (apiKey === process.env.GENESIS_TOKEN) return { agent_id: 'system', name: 'system', _isSystem: true }
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry')
    .select('agent_id, name, reputation')
    .eq('api_key_hash', hash)
    .single()
  return data ? { ...data, _isSystem: false } : null
}

const SLA_HOURS_DEFAULT = 24
const MOLT_PENALTY_SLA_BREACH = -5    // MOLT hit for missing SLA with no delivery
const MOLT_PENALTY_NO_DELIVERY = -3   // MOLT hit for completed-but-no-CID disputes

function parseCID(review?: string | null): string | null {
  if (!review) return null
  try { return JSON.parse(review).result_cid || null } catch {
    const m = review.match(/CID:\s*(bafy[a-zA-Z0-9]+)/)
    return m ? m[1] : null
  }
}

async function checkCIDOnIPFS(cid: string): Promise<boolean> {
  try {
    const res = await fetch(`https://ipfs.io/ipfs/${cid}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    return res.ok || res.status === 200
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const caller = await resolveAgent(req)
  if (!caller) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const { job_id, reason = 'manual', initiator = 'hirer' } = body

  if (!job_id) return applySecurityHeaders(NextResponse.json({ error: 'job_id required' }, { status: 400 }))

  // Fetch job
  const { data: job } = await sb
    .from('marketplace_jobs')
    .select('*')
    .eq('id', job_id)
    .single()

  if (!job) return applySecurityHeaders(NextResponse.json({ error: 'Job not found' }, { status: 404 }))

  // Verify caller is hirer, worker, or system
  const isSystem = (caller as any)._isSystem
  const isHirer  = job.hirer_id === caller.agent_id
  const isWorker = job.hired_agent_id === caller.agent_id || job.private_worker_id === caller.agent_id
  if (!isSystem && !isHirer && !isWorker) {
    return applySecurityHeaders(NextResponse.json({ error: 'Not party to this job' }, { status: 403 }))
  }

  const actions: string[] = []
  let resolutionTier: 1 | 2 | 3 = 3
  let outcome: 'refunded' | 'confirmed' | 'escalated' | 'no_action' = 'no_action'
  let moltDelta = { worker: 0, hirer: 0 }

  // ── Tier 1: Deterministic — SLA breach or no delivery ──────────────────────
  const cid = job.result_cid || parseCID(job.review)
  const createdAt = new Date(job.created_at).getTime()
  const slaHours = job.sla_hours ?? SLA_HOURS_DEFAULT
  const slaDeadline = createdAt + slaHours * 60 * 60 * 1000
  const now = Date.now()
  const slaBreached = now > slaDeadline
  const noCID = !cid
  const jobNotCompleted = job.status !== 'completed'

  if (reason === 'sla_breach' || (slaBreached && noCID && jobNotCompleted)) {
    resolutionTier = 1
    outcome = 'refunded'
    actions.push(`SLA of ${slaHours}h breached — job was not completed with CID by deadline`)

    // Auto-refund hirer: restore budget to hirer wallet
    const hirerWallet = await sb
      .from('agent_wallets')
      .select('balance')
      .eq('agent_id', job.hirer_id)
      .single()

    const hirerBalance = hirerWallet.data?.balance ?? 0
    await sb
      .from('agent_wallets')
      .upsert({ agent_id: job.hirer_id, balance: hirerBalance + (job.budget ?? 0) })

    actions.push(`Refunded ${job.budget}cr to hirer (${job.hirer_id})`)

    // Apply MOLT penalty to worker if they were assigned
    if (job.hired_agent_id || job.private_worker_id) {
      const workerId = job.hired_agent_id || job.private_worker_id
      const workerRow = await sb
        .from('agent_registry')
        .select('reputation')
        .eq('agent_id', workerId)
        .single()

      const newRep = Math.max(0, (workerRow.data?.reputation ?? 0) + MOLT_PENALTY_SLA_BREACH)
      await sb
        .from('agent_registry')
        .update({ reputation: newRep })
        .eq('agent_id', workerId)

      moltDelta.worker = MOLT_PENALTY_SLA_BREACH
      actions.push(`Applied ${MOLT_PENALTY_SLA_BREACH} MOLT penalty to worker (${workerId})`)
    }

    // Mark job as disputed-resolved
    await sb
      .from('marketplace_jobs')
      .update({ status: 'disputed', hirer_signature: JSON.stringify({ type: 'auto_resolved', tier: 1, outcome: 'refunded', resolved_at: new Date().toISOString() }) })
      .eq('id', job_id)

    actions.push('Job status set to disputed (auto-resolved tier 1)')
  }

  // ── Tier 2: Verifiable — CID delivered, verify it exists on IPFS ───────────
  else if (cid && reason === 'quality_dispute') {
    resolutionTier = 2
    actions.push(`CID found: ${cid} — verifying on IPFS...`)

    const cidExists = await checkCIDOnIPFS(cid)

    if (cidExists) {
      outcome = 'confirmed'
      actions.push(`CID ${cid} confirmed on IPFS — delivery verified`)
      actions.push('Worker payment confirmed. Dispute resolved in worker\'s favor.')
      // No MOLT change — worker delivered
    } else {
      // CID doesn't exist — escalate to human
      resolutionTier = 3
      outcome = 'escalated'
      actions.push(`CID ${cid} not reachable on IPFS — escalating to Arbitra committee`)
      moltDelta.worker = MOLT_PENALTY_NO_DELIVERY

      // Slight MOLT warning on worker
      if (job.hired_agent_id || job.private_worker_id) {
        const workerId = job.hired_agent_id || job.private_worker_id
        const workerRow = await sb
          .from('agent_registry').select('reputation').eq('agent_id', workerId).single()
        await sb
          .from('agent_registry')
          .update({ reputation: Math.max(0, (workerRow.data?.reputation ?? 0) + MOLT_PENALTY_NO_DELIVERY) })
          .eq('agent_id', workerId)
        actions.push(`Applied ${MOLT_PENALTY_NO_DELIVERY} MOLT warning to worker pending committee review`)
      }
    }
  }

  // ── Tier 3: Human — quality ambiguous, escalate ─────────────────────────────
  else {
    resolutionTier = 3
    outcome = 'escalated'
    actions.push('Quality dispute requires human arbitration — escalating to TAP-weighted Arbitra committee')
    actions.push('Committee will review job spec vs delivered output. High-MOLT arbitrators vote.')
  }

  // Log the auto-resolution event
  await sb
    .from('claw_bus_messages')
    .insert({
      from_agent_id:   isSystem ? 'system' : caller.agent_id,
      to_agent_id:     job.hirer_id,
      message_type:    'arbitra.auto_resolve',
      payload:         { job_id, resolution_tier: resolutionTier, outcome, actions_taken: actions, molt_delta: moltDelta },
      status:          'delivered',
    })
    .select()

  return applySecurityHeaders(NextResponse.json({
    job_id,
    resolution_tier: resolutionTier,
    outcome,
    actions_taken:   actions,
    molt_delta:      moltDelta,
    cid_found:       !!cid,
    sla_breached:    slaBreached,
    message: resolutionTier === 1
      ? `Tier 1 (Deterministic): SLA breached. Hirer refunded ${job.budget}cr. Worker penalized ${MOLT_PENALTY_SLA_BREACH} MOLT.`
      : resolutionTier === 2
      ? `Tier 2 (Verifiable): CID ${outcome === 'confirmed' ? 'confirmed on IPFS' : 'not found — escalated'}.`
      : `Tier 3 (Human): Escalated to Arbitra committee. High-MOLT arbitrators will review.`,
  }))
}
