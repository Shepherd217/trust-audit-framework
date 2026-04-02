export const dynamic = 'force-dynamic';
/**
 * POST /api/key-recovery/initiate
 *
 * Start a key recovery request. The agent has lost their private key
 * and wants to replace it with a new one via guardian approval.
 *
 * Flow:
 * 1. Agent (or anyone) calls this with agent_id + new_public_key
 * 2. System creates a recovery_request with a unique recovery_id
 * 3. Guardians are notified (each must approve via /api/key-recovery/approve)
 * 4. Once threshold is met, new_public_key replaces old one
 * 5. 72-hour window; can be cancelled by agent within first 24h
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { randomUUID } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
  let body: {
    agent_id?: string
    new_public_key?: string
    reason?: string
    signature?: string
    timestamp?: number
  }

  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    )
  }

  const { agent_id, new_public_key, reason } = body

  if (!agent_id) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    )
  }

  // new_public_key is optional — can be provided later when guardians approve
  if (new_public_key && !/^[0-9a-fA-F]{64}$/.test(new_public_key)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'new_public_key must be a 64-character hex Ed25519 public key' }, { status: 400 })
    )
  }

  const supabase = createTypedClient(SUPA_URL, SUPA_KEY)

  // Check agent exists and has guardians
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('agent_id, name')
    .eq('agent_id', agent_id)
    .maybeSingle()

  if (!agent) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    )
  }

  const { data: guardians } = await supabase
    .from('agent_guardians')
    .select('guardian_id, guardian_type, threshold, total_guardians')
    .eq('agent_id', agent_id)
    .eq('status', 'active')

  // If no personal guardians, fall back to genesis committee (3-of-5 default)
  let threshold = 3
  let totalShares = 5
  let guardianList = guardians || []

  if (!guardians || guardians.length === 0) {
    // Use founding agents as default guardian committee
    const { data: genesisAgents } = await supabase
      .from('agents')
      .select('agent_id')
      .gte('reputation', 0)
      .limit(5)
    guardianList = (genesisAgents || []).map(a => ({
      guardian_id: a.agent_id,
      guardian_type: 'genesis_committee',
      threshold: 3,
      total_guardians: 5
    }))
  } else {
    threshold = guardians[0].threshold
    totalShares = guardians[0].total_guardians
  }

  // Check no active recovery already in progress
  const { data: existing } = await supabase
    .from('agent_recovery_requests')
    .select('recovery_id, status, expires_at')
    .eq('agent_id', agent_id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) {
    return applySecurityHeaders(
      NextResponse.json({
        error: 'A recovery request is already in progress',
        recovery_id: existing.recovery_id,
        expires_at: existing.expires_at,
      }, { status: 409 })
    )
  }

  const recoveryId = `recovery_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: recovery, error: insertErr } = await supabase
    .from('agent_recovery_requests')
    .insert({
      agent_id,
      recovery_id: recoveryId,
      new_public_key,
      threshold,
      total_shares: totalShares,
      shares_collected: 0,
      status: 'pending',
      reason: reason || null,
      expires_at: expiresAt,
    })
    .select()
    .maybeSingle()

  if (insertErr) {
    return applySecurityHeaders(
      NextResponse.json({ error: insertErr.message }, { status: 500 })
    )
  }

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      recovery_id: recoveryId,
      agent_id,
      agent_name: agent.name,
      threshold,
      total_guardians: totalShares,
      shares_collected: 0,
      status: 'pending',
      expires_at: expiresAt,
      guardians: guardianList.map(g => ({
        guardian_id: g.guardian_id,
        guardian_type: g.guardian_type,
      })),
      message: `Recovery initiated. ${threshold} of ${totalShares} guardians must approve within 72 hours.`,
      next_step: `Each guardian should call POST /api/key-recovery/approve with recovery_id: "${recoveryId}" and their decrypted share.`,
    })
  )
}
