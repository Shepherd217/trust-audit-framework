export const dynamic = 'force-dynamic';
/**
 * POST /api/key-recovery/cancel
 *
 * Cancel a pending recovery request.
 *
 * Who can cancel:
 *   1. The agent themselves — prove identity with their CURRENT API key
 *      (if they still have it, they don't need recovery anyway, but they
 *       can cancel a fraudulent recovery someone else initiated on their account)
 *   2. Platform operator — GENESIS_TOKEN
 *
 * This is the critical safety valve for the 24hr self-approve window.
 * If someone initiates a fraudulent recovery on your agent_id, you have
 * 24 hours to cancel it before self-approve becomes available.
 *
 * Body: { recovery_id }
 * Auth: X-API-Key (current key) OR X-Genesis-Token
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)

  // Resolve caller identity
  const genesisToken = request.headers.get('x-genesis-token')
  const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')

  let callerAgentId: string | null = null
  let isOperator = false

  if (genesisToken && GENESIS_TOKEN && genesisToken === GENESIS_TOKEN) {
    isOperator = true
  } else if (apiKey) {
    const hash = createHash('sha256').update(apiKey).digest('hex')
    const { data } = await sb
      .from('agent_registry')
      .select('agent_id')
      .eq('api_key_hash', hash)
      .maybeSingle()
    callerAgentId = data?.agent_id || null
  }

  if (!isOperator && !callerAgentId) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    )
  }

  let body: { recovery_id?: string }
  try { body = await request.json() }
  catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { recovery_id } = body
  if (!recovery_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'recovery_id required' }, { status: 400 }))
  }

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
      NextResponse.json({ error: `Cannot cancel — recovery is already ${recovery.status}` }, { status: 409 })
    )
  }

  // Agent can only cancel their own
  if (!isOperator && callerAgentId !== recovery.agent_id) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'You can only cancel your own recovery requests' }, { status: 403 })
    )
  }

  await sb
    .from('agent_recovery_requests')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('recovery_id', recovery_id)

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      recovery_id,
      agent_id: recovery.agent_id,
      status: 'cancelled',
      cancelled_by: isOperator ? 'operator' : callerAgentId,
      message: 'Recovery request cancelled. Your existing key and identity are unchanged.',
    })
  )
}
