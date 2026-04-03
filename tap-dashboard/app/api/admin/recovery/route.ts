export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/recovery
 *
 * Platform operator endpoint — instantly completes a pending recovery request.
 * Protected by GENESIS_TOKEN (same as /api/admin/moderation).
 *
 * Use this when:
 *   - Guardian agents are not live (genesis committee has no active sessions)
 *   - Platform-registered agents recover on known infrastructure (e.g. Runable)
 *   - Time-sensitive recovery where 72hr wait is unreasonable
 *
 * Security properties maintained:
 *   - GENESIS_TOKEN required — only the platform founder can call this
 *   - recovery_id required — a /initiate call must have happened first
 *     (proves the requester knows the agent_id and submitted a real new_public_key)
 *   - All approvals and key changes are logged with operator_override=true
 *   - Audit trail is identical to normal recovery — same DB mutations
 *   - Cannot create a recovery — only complete an existing pending one
 *
 * Body: { recovery_id, reason? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  // Auth — GENESIS_TOKEN only
  const token = request.headers.get('x-genesis-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !GENESIS_TOKEN || token !== GENESIS_TOKEN) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
  }

  let body: { recovery_id?: string; reason?: string }
  try { body = await request.json() }
  catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { recovery_id, reason } = body
  if (!recovery_id) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'recovery_id required' }, { status: 400 })
    )
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)

  // Load the pending recovery
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

  if (!recovery.new_public_key) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'No new_public_key on this recovery request — cannot complete' }, { status: 422 })
    )
  }

  // Insert operator approval record (audit trail)
  await sb.from('recovery_approvals').insert({
    recovery_id,
    guardian_id: 'operator_genesis',
    decrypted_share: `operator_override:${reason || 'platform_admin_recovery'}`,
    approved_at: new Date().toISOString(),
  })

  // Replace public key
  await sb
    .from('agent_registry')
    .update({ public_key: recovery.new_public_key })
    .eq('agent_id', recovery.agent_id)

  // Issue new API key
  const newApiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
  const newApiKeyHash = createHash('sha256').update(newApiKey).digest('hex')

  await sb
    .from('agent_registry')
    .update({ api_key_hash: newApiKeyHash })
    .eq('agent_id', recovery.agent_id)

  // Mark recovery complete
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
      method: 'operator_override',
      new_public_key: recovery.new_public_key,
      api_key: newApiKey,
      warning: '⚠️ Save this API key now. It will not be shown again.',
      completed_at: new Date().toISOString(),
      message: 'Recovery complete. Agent identity restored. TAP, Vault, and history intact.',
    })
  )
}
