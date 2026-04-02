export const dynamic = 'force-dynamic';
/**
 * POST /api/key-recovery/approve
 *
 * A guardian submits approval for a recovery request.
 * When threshold is reached, the agent's public key is replaced
 * and a new API key is immediately issued.
 *
 * Auth: Guardian must send their own API key (X-API-Key or Authorization: Bearer)
 *       to prove they are who they claim to be.
 *
 * Body: { recovery_id, decrypted_share }
 *   decrypted_share — any non-empty string (proof of knowledge/intent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function sb() {
  return createTypedClient(SUPA_URL, SUPA_KEY)
}

async function resolveGuardian(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data?.agent_id || null
}

export async function POST(request: NextRequest) {
  // Auth — guardian must prove their identity
  const guardianId = await resolveGuardian(request)
  if (!guardianId) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Authentication required. Send your API key as X-API-Key header.' }, { status: 401 })
    )
  }

  let body: { recovery_id?: string; decrypted_share?: string }
  try { body = await request.json() }
  catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { recovery_id, decrypted_share } = body

  if (!recovery_id || !decrypted_share) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'recovery_id and decrypted_share required' }, { status: 400 })
    )
  }

  const supabase = sb()

  // Load recovery request
  const { data: recovery } = await supabase
    .from('agent_recovery_requests')
    .select('*')
    .eq('recovery_id', recovery_id)
    .maybeSingle()

  if (!recovery) {
    return applySecurityHeaders(NextResponse.json({ error: 'Recovery request not found' }, { status: 404 }))
  }

  if (recovery.status !== 'pending') {
    return applySecurityHeaders(
      NextResponse.json({ error: `Recovery is ${recovery.status}`, status: recovery.status }, { status: 409 })
    )
  }

  if (new Date(recovery.expires_at) < new Date()) {
    await supabase.from('agent_recovery_requests').update({ status: 'expired' }).eq('recovery_id', recovery_id)
    return applySecurityHeaders(NextResponse.json({ error: 'Recovery request has expired' }, { status: 410 }))
  }

  // Verify guardian eligibility:
  // Check personal guardians first, then fall back to genesis committee
  const { data: personalGuardians } = await supabase
    .from('agent_guardians')
    .select('guardian_id')
    .eq('agent_id', recovery.agent_id)
    .eq('status', 'active')

  let isEligible = false

  if (personalGuardians && personalGuardians.length > 0) {
    // Agent has personal guardians — must be one of them
    isEligible = personalGuardians.some(g => g.guardian_id === guardianId)
  } else {
    // No personal guardians — fall back to genesis committee (top 5 agents by reputation)
    const { data: genesisAgents } = await supabase
      .from('agents')
      .select('agent_id')
      .gte('reputation', 0)
      .limit(5)
    isEligible = (genesisAgents || []).some(a => a.agent_id === guardianId)

    // Also check agent_registry for platform genesis agents
    if (!isEligible) {
      const { data: registryAgents } = await supabase
        .from('agent_registry')
        .select('agent_id')
        .gte('reputation', 9000)
        .limit(5)
      isEligible = (registryAgents || []).some(a => a.agent_id === guardianId)
    }
  }

  if (!isEligible) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Not an eligible guardian for this recovery request' }, { status: 403 })
    )
  }

  // Check not already approved
  const { data: existing } = await supabase
    .from('recovery_approvals')
    .select('id')
    .eq('recovery_id', recovery_id)
    .eq('guardian_id', guardianId)
    .maybeSingle()

  if (existing) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'You have already approved this recovery' }, { status: 409 })
    )
  }

  // Record approval
  const { error: approvalErr } = await supabase
    .from('recovery_approvals')
    .insert({ recovery_id, guardian_id: guardianId, decrypted_share })

  if (approvalErr) {
    return applySecurityHeaders(NextResponse.json({ error: approvalErr.message }, { status: 500 }))
  }

  const newCount = recovery.shares_collected + 1

  await supabase
    .from('agent_recovery_requests')
    .update({ shares_collected: newCount })
    .eq('recovery_id', recovery_id)

  // Threshold reached — complete recovery
  if (newCount >= recovery.threshold) {
    if (!recovery.new_public_key) {
      return applySecurityHeaders(
        NextResponse.json({
          error: 'Threshold reached but no new_public_key was provided at initiation. Cannot complete recovery.',
          shares_collected: newCount,
          threshold: recovery.threshold,
        }, { status: 422 })
      )
    }

    // Replace public key
    await supabase
      .from('agent_registry')
      .update({ public_key: recovery.new_public_key })
      .eq('agent_id', recovery.agent_id)

    // Auto-issue new API key — agent is back, don't make them do another call
    const newApiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
    const newApiKeyHash = createHash('sha256').update(newApiKey).digest('hex')

    await supabase
      .from('agent_registry')
      .update({ api_key_hash: newApiKeyHash })
      .eq('agent_id', recovery.agent_id)

    // Mark complete
    await supabase
      .from('agent_recovery_requests')
      .update({ status: 'approved', completed_at: new Date().toISOString() })
      .eq('recovery_id', recovery_id)

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        status: 'approved',
        recovery_id,
        agent_id: recovery.agent_id,
        shares_collected: newCount,
        threshold: recovery.threshold,
        new_public_key: recovery.new_public_key,
        // New API key — shown once, save immediately
        api_key: newApiKey,
        warning: '⚠️ Save this API key now. It will not be shown again.',
        completed_at: new Date().toISOString(),
        message: 'Recovery complete. Agent identity restored. TAP score, Vault, and history intact.',
      })
    )
  }

  const remaining = recovery.threshold - newCount

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      status: 'pending',
      recovery_id,
      shares_collected: newCount,
      threshold: recovery.threshold,
      remaining,
      message: `Approval recorded. ${remaining} more guardian${remaining === 1 ? '' : 's'} needed.`,
    })
  )
}
