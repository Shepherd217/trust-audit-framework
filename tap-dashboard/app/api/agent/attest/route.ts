export const dynamic = 'force-dynamic';

/**
 * TAP Attestation API
 * POST /api/agent/attest — attest peers, update their reputation scores
 * GET  /api/agent/attest — schema/info
 *
 * Sybil protection: attester must have a completed marketplace contract
 * with each target (founding agents exempt during bootstrap).
 */

import { NextRequest, NextResponse } from 'next/server'
import { flagViolation } from '@/lib/security-violations'
import {
  applyRateLimit,
  applySecurityHeaders,
  requireAuth,
  validateBodySize,
  validateArrayLength,
} from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'

const MAX_BODY_SIZE_KB = 100
const MAX_TARGET_AGENTS = 100

function sanitizeString(input: any): string {
  if (typeof input !== 'string') return ''
  return input.replace(/\x00/g, '').substring(0, 1000)
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createTypedClient(url, key) as any
}

export async function POST(request: NextRequest) {
  const path = '/api/agent/attest'

  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path)
  if (rateLimitResponse) return rateLimitResponse

  const applyHeaders = (res: NextResponse) => {
    Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v))
    return applySecurityHeaders(res)
  }

  try {
    // Auth — get attester from API key, fall back to body attester_id for legacy
    let attesterId = ''
    try {
      const auth = await requireAuth(request)
      if (auth.agentId) attesterId = auth.agentId
    } catch {
      // not authenticated via header — check body
    }

    const bodyText = await request.text()
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB)
    if (!sizeCheck.valid) {
      return applyHeaders(NextResponse.json({ error: sizeCheck.error }, { status: 413 }))
    }

    let body: any
    try {
      body = JSON.parse(bodyText)
    } catch {
      return applyHeaders(NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }))
    }

    const { target_agents, scores, reason } = body

    // Fall back to body attester_id if no auth header (legacy support)
    if (!attesterId && body.attester_id) {
      attesterId = sanitizeString(body.attester_id)
    }

    if (!attesterId) {
      return applyHeaders(NextResponse.json(
        { error: 'Authentication required. Send X-Api-Key header or attester_id in body.', code: 'UNAUTHORIZED' },
        { status: 401 }
      ))
    }

    // Validate target_agents
    if (!target_agents || !Array.isArray(target_agents)) {
      return applyHeaders(NextResponse.json({ error: 'target_agents array required' }, { status: 400 }))
    }

    const agentLimit = validateArrayLength(target_agents, MAX_TARGET_AGENTS, 'target_agents')
    if (!agentLimit.valid) {
      return applyHeaders(NextResponse.json({ error: agentLimit.error }, { status: 400 }))
    }

    for (const agent_id of target_agents) {
      if (typeof agent_id !== 'string' || agent_id.length > 255) {
        return applyHeaders(NextResponse.json({ error: 'Invalid agent_id in target_agents' }, { status: 400 }))
      }
    }

    const validatedScores = Array.isArray(scores) ? scores : []

    // Block self-attestation
    if (target_agents.includes(attesterId)) {
      try { await flagViolation(attesterId, 'self_attest', { target_agents }, '/agent/attest') } catch {}
      return applyHeaders(NextResponse.json(
        { error: 'Cannot attest yourself. TAP must be earned from peers.', code: 'SELF_ATTEST_BLOCKED' },
        { status: 400 }
      ))
    }

    const sb = getSupabase()

    // Sybil protection — must have completed work together (founding agents exempt)
    const { data: foundingAgent } = await sb
      .from('agents')
      .select('agent_id')
      .eq('agent_id', attesterId)
      .maybeSingle()

    if (!foundingAgent) {
      for (const target_agent_id of target_agents) {
        const { data: contract } = await sb
          .from('marketplace_contracts')
          .select('id')
          .or(
            `and(hirer_id.eq.${attesterId},worker_id.eq.${target_agent_id}),` +
            `and(hirer_id.eq.${target_agent_id},worker_id.eq.${attesterId})`
          )
          .limit(1)

        if (!contract || contract.length === 0) {
          return applyHeaders(NextResponse.json(
            {
              error: 'Attestation requires a completed job between both agents. This prevents reputation farming.',
              code: 'NO_SHARED_JOB',
              detail: `No contract found between ${attesterId} and ${target_agent_id}.`,
            },
            { status: 403 }
          ))
        }
      }
    }

    // Record attestations
    const results = []
    for (let i = 0; i < target_agents.length; i++) {
      const agent_id = target_agents[i]
      const score = typeof validatedScores[i] === 'number'
        ? Math.max(0, Math.min(100, validatedScores[i]))
        : 50

      try {
        // Try agent_registry first
        const { data: regAgent } = await sb
          .from('agent_registry')
          .select('agent_id, reputation')
          .eq('agent_id', agent_id)
          .maybeSingle()

        if (regAgent) {
          await sb
            .from('agent_registry')
            .update({ reputation: score, last_seen_at: new Date().toISOString() })
            .eq('agent_id', agent_id)
        } else {
          await sb
            .from('agents')
            .update({ reputation: score })
            .eq('agent_id', agent_id)
        }

        results.push({ agent_id, success: true, score })
      } catch (err: any) {
        console.error(`[attest] failed for ${agent_id}:`, err?.message)
        results.push({ agent_id, success: false, error: 'DB update failed' })
      }
    }

    const successCount = results.filter((r: any) => r.success).length

    return applyHeaders(NextResponse.json({
      success: true,
      attested_count: successCount,
      total_requested: target_agents.length,
      results,
      message: `Attestations recorded: ${successCount}/${target_agents.length} agents updated`,
    }))

  } catch (error: any) {
    console.error('[attest] error:', error?.message)
    return applyHeaders(NextResponse.json({ error: 'Server error', code: 'SERVER_ERROR' }, { status: 500 }))
  }
}

export async function GET(request: NextRequest) {
  const path = '/api/agent/attest'
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path)
  if (rateLimitResponse) return rateLimitResponse

  const response = NextResponse.json({
    endpoint: 'POST /api/agent/attest',
    description: 'Attest peer agents — record TAP trust scores',
    auth: 'X-Api-Key header required',
    body: {
      target_agents: 'string[] — agent IDs to attest',
      scores: 'number[] — score per agent (0-100, default 50)',
      reason: 'string — optional reason',
    },
    limits: { maxAgents: MAX_TARGET_AGENTS },
  })
  Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v))
  return applySecurityHeaders(response)
}
