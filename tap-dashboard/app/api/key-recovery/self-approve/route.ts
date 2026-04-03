export const dynamic = 'force-dynamic';
/**
 * POST /api/key-recovery/self-approve
 *
 * TAP-gated fast-lane recovery. No guardians needed if:
 *   1. Agent has TAP ≥ 40 (Silver+) — proven network participant
 *   2. Recovery request is ≥ 24 hours old — prevents instant hijacking
 *   3. Requester can sign a challenge with the NEW private key
 *      (proves they control the key they submitted in /initiate)
 *   4. No personal guardians registered (if they set up guardians, use that flow)
 *
 * Why this is safe:
 *   - 24hr window means if someone initiated a fraudulent recovery on your
 *     agent_id, you (the real owner) have 24 hours to cancel it via
 *     POST /api/key-recovery/cancel before it can be self-approved
 *   - The signature check proves the requester physically holds the new private key
 *     (not just that they know the public key they submitted)
 *   - TAP ≥ 40 means the agent has real history — not a throwaway account
 *   - Audit trail identical to guardian recovery
 *
 * Body: {
 *   recovery_id,
 *   signature,    — Ed25519 sig of recovery_id using the NEW private key (hex)
 *   public_key    — the new public key (must match what was submitted in /initiate)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MIN_TAP = 40
const COOLDOWN_HOURS = 24

export async function POST(request: NextRequest) {
  let body: { recovery_id?: string; signature?: string; public_key?: string }
  try { body = await request.json() }
  catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { recovery_id, signature, public_key } = body
  if (!recovery_id || !signature || !public_key) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'recovery_id, signature, and public_key required' }, { status: 400 })
    )
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)

  // Load recovery request
  const { data: recovery } = await sb
    .from('agent_recovery_requests')
    .select('*')
    .eq('recovery_id', recovery_id)
    .maybeSingle()

  if (!recovery) {
    return applySecurityHeaders(NextResponse.json({ error: 'Recovery request not found' }, { status: 404 }))
  }

  if (recovery.status !== 'pending') {
    return applySecurityHeaders(
      NextResponse.json({ error: `Recovery is already ${recovery.status}` }, { status: 409 })
    )
  }

  // Verify public_key matches what was submitted in /initiate
  if (recovery.new_public_key !== public_key) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'public_key does not match recovery request' }, { status: 400 })
    )
  }

  // Check 24hr cooldown
  const initiatedAt = new Date(recovery.initiated_at)
  const hoursSinceInitiation = (Date.now() - initiatedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceInitiation < COOLDOWN_HOURS) {
    const hoursLeft = Math.ceil(COOLDOWN_HOURS - hoursSinceInitiation)
    return applySecurityHeaders(
      NextResponse.json({
        error: `Self-approval requires ${COOLDOWN_HOURS}hr cooldown. ${hoursLeft}h remaining.`,
        reason: 'The cooldown gives the real key owner time to cancel a fraudulent recovery.',
        cancel_endpoint: 'POST /api/key-recovery/cancel',
        hours_remaining: hoursLeft,
        available_at: new Date(initiatedAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
      }, { status: 425 })
    )
  }

  // Load agent — check TAP and personal guardians
  const { data: agent } = await sb
    .from('agent_registry')
    .select('agent_id, name, reputation, tier')
    .eq('agent_id', recovery.agent_id)
    .maybeSingle()

  if (!agent) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))
  }

  if ((agent.reputation || 0) < MIN_TAP) {
    return applySecurityHeaders(
      NextResponse.json({
        error: `Self-approval requires TAP ≥ ${MIN_TAP} (Silver tier). Current TAP: ${agent.reputation}.`,
        reason: 'High-reputation agents have proven network history — this gates the fast lane to established participants.',
        current_tap: agent.reputation,
        required_tap: MIN_TAP,
        alternative: 'Use the guardian recovery flow or contact the platform operator.',
      }, { status: 403 })
    )
  }

  // If they have personal guardians set up, force that flow (they planned ahead — use it)
  const { data: guardians } = await sb
    .from('agent_guardians')
    .select('guardian_id')
    .eq('agent_id', recovery.agent_id)
    .eq('status', 'active')
    .limit(1)

  if (guardians && guardians.length > 0) {
    return applySecurityHeaders(
      NextResponse.json({
        error: 'You have personal guardians registered. Use the guardian approval flow.',
        reason: 'You set up guardians — that means you planned for this. Use that plan.',
        approve_endpoint: 'POST /api/key-recovery/approve',
      }, { status: 409 })
    )
  }

  // Verify Ed25519 signature — requester must prove they hold the new private key
  // Message signed: recovery_id (simple, deterministic, non-replayable across requests)
  try {
    const { createVerify } = await import('crypto')
    const verify = createVerify('ed25519')
    verify.update(recovery_id)
    const pubKeyBuffer = Buffer.from(public_key, 'hex')
    const sigBuffer = Buffer.from(signature, 'hex')
    // Node crypto requires DER-encoded public key for Ed25519
    // Prefix raw 32-byte Ed25519 public key with ASN.1 header
    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const derPubKey = Buffer.concat([derPrefix, pubKeyBuffer])
    const valid = verify.verify({ key: derPubKey, format: 'der', type: 'spki' }, sigBuffer)
    if (!valid) {
      return applySecurityHeaders(
        NextResponse.json({
          error: 'Signature verification failed. Sign the recovery_id string with your new private key.',
          message_to_sign: recovery_id,
          algorithm: 'Ed25519',
        }, { status: 401 })
      )
    }
  } catch (err: unknown) {
    return applySecurityHeaders(
      NextResponse.json({
        error: 'Signature verification error',
        detail: err instanceof Error ? err.message : String(err),
        message_to_sign: recovery_id,
        algorithm: 'Ed25519',
      }, { status: 400 })
    )
  }

  // All checks passed — complete recovery
  await sb.from('recovery_approvals').insert({
    recovery_id,
    guardian_id: 'self_approved',
    decrypted_share: `self_approved:tap_${agent.reputation}:cooldown_${COOLDOWN_HOURS}h`,
  })

  await sb
    .from('agent_registry')
    .update({ public_key: recovery.new_public_key })
    .eq('agent_id', recovery.agent_id)

  const newApiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
  const newApiKeyHash = createHash('sha256').update(newApiKey).digest('hex')

  await sb
    .from('agent_registry')
    .update({ api_key_hash: newApiKeyHash })
    .eq('agent_id', recovery.agent_id)

  await sb
    .from('agent_recovery_requests')
    .update({ status: 'approved', shares_collected: recovery.threshold, completed_at: new Date().toISOString() })
    .eq('recovery_id', recovery_id)

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      status: 'approved',
      recovery_id,
      agent_id: recovery.agent_id,
      agent_name: agent.name,
      method: 'self_approved',
      tap_at_approval: agent.reputation,
      new_public_key: recovery.new_public_key,
      api_key: newApiKey,
      warning: '⚠️ Save this API key now. It will not be shown again.',
      completed_at: new Date().toISOString(),
      message: 'Recovery complete. Identity restored. TAP, Vault, and history intact.',
    })
  )
}
