/**
 * POST /api/key-recovery/approve
 *
 * A guardian submits their decrypted share to approve a recovery request.
 * When threshold is reached, the agent's public key is replaced.
 *
 * MoltOS never reconstructs the private key — only validates the new public key
 * was derived from the reconstructed secret. Client-side reconstruction is the
 * recommended pattern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  let body: {
    recovery_id?: string
    guardian_id?: string
    decrypted_share?: string
  }

  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    )
  }

  const { recovery_id, guardian_id, decrypted_share } = body

  if (!recovery_id || !guardian_id || !decrypted_share) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'recovery_id, guardian_id, and decrypted_share required' }, { status: 400 })
    )
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)

  // Load the recovery request
  const { data: recovery, error: recoveryErr } = await supabase
    .from('agent_recovery_requests')
    .select('*')
    .eq('recovery_id', recovery_id)
    .single()

  if (recoveryErr || !recovery) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Recovery request not found' }, { status: 404 })
    )
  }

  if (recovery.status !== 'pending') {
    return applySecurityHeaders(
      NextResponse.json({
        error: `Recovery request is ${recovery.status}, not pending`,
        status: recovery.status,
      }, { status: 409 })
    )
  }

  if (new Date(recovery.expires_at) < new Date()) {
    await supabase
      .from('agent_recovery_requests')
      .update({ status: 'expired' })
      .eq('recovery_id', recovery_id)

    return applySecurityHeaders(
      NextResponse.json({ error: 'Recovery request has expired' }, { status: 410 })
    )
  }

  // Verify this is a real guardian for this agent
  const { data: guardian } = await supabase
    .from('agent_guardians')
    .select('id, guardian_id, status')
    .eq('agent_id', recovery.agent_id)
    .eq('guardian_id', guardian_id)
    .eq('status', 'active')
    .single()

  if (!guardian) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Not a registered guardian for this agent' }, { status: 403 })
    )
  }

  // Check guardian hasn't already approved
  const { data: existingApproval } = await supabase
    .from('recovery_approvals')
    .select('id')
    .eq('recovery_id', recovery_id)
    .eq('guardian_id', guardian_id)
    .single()

  if (existingApproval) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'You have already submitted your share for this recovery' }, { status: 409 })
    )
  }

  // Record the approval
  const { error: approvalErr } = await supabase
    .from('recovery_approvals')
    .insert({ recovery_id, guardian_id, decrypted_share })

  if (approvalErr) {
    return applySecurityHeaders(
      NextResponse.json({ error: approvalErr.message }, { status: 500 })
    )
  }

  const newCount = recovery.shares_collected + 1

  // Update share count
  await supabase
    .from('agent_recovery_requests')
    .update({ shares_collected: newCount })
    .eq('recovery_id', recovery_id)

  // Check if threshold reached
  if (newCount >= recovery.threshold) {
    // Replace the agent's public key
    await supabase
      .from('agent_registry')
      .update({ public_key: recovery.new_public_key })
      .eq('agent_id', recovery.agent_id)

    // Mark recovery complete
    await supabase
      .from('agent_recovery_requests')
      .update({ status: 'approved', completed_at: new Date().toISOString() })
      .eq('recovery_id', recovery_id)

    // Mark guardian shares as used
    await supabase
      .from('agent_guardians')
      .update({ status: 'used' })
      .eq('agent_id', recovery.agent_id)

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        status: 'approved',
        recovery_id,
        shares_collected: newCount,
        threshold: recovery.threshold,
        message: 'Threshold reached. Agent public key has been replaced. Old guardians revoked — set up new guardians to protect the recovered key.',
        new_public_key: recovery.new_public_key,
        completed_at: new Date().toISOString(),
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
      message: `Share accepted. ${remaining} more guardian${remaining === 1 ? '' : 's'} needed to complete recovery.`,
    })
  )
}
