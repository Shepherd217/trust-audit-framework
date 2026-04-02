export const dynamic = 'force-dynamic';
/**
 * GET /api/key-recovery/status?recovery_id=xxx
 * GET /api/key-recovery/status?agent_id=xxx  (latest request)
 *
 * Check the status of an active recovery request.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const recoveryId = searchParams.get('recovery_id')
  const agentId = searchParams.get('agent_id')

  if (!recoveryId && !agentId) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'recovery_id or agent_id required' }, { status: 400 })
    )
  }

  const supabase = createTypedClient(SUPA_URL, SUPA_KEY)

  let query = supabase
    .from('agent_recovery_requests')
    .select('recovery_id, agent_id, shares_collected, threshold, total_shares, status, reason, initiated_at, expires_at, completed_at')
    .order('initiated_at', { ascending: false })
    .limit(1)

  if (recoveryId) {
    query = query.eq('recovery_id', recoveryId)
  } else if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Recovery request not found' }, { status: 404 })
    )
  }

  const now = new Date()
  const expiresAt = new Date(data.expires_at)
  const isExpired = expiresAt < now && data.status === 'pending'

  if (isExpired) {
    await supabase
      .from('agent_recovery_requests')
      .update({ status: 'expired' })
      .eq('recovery_id', data.recovery_id)
    data.status = 'expired'
  }

  const remaining = Math.max(0, data.threshold - data.shares_collected)
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)))

  return applySecurityHeaders(
    NextResponse.json({
      recovery_id: data.recovery_id,
      agent_id: data.agent_id,
      status: data.status,
      shares_collected: data.shares_collected,
      threshold: data.threshold,
      total_guardians: data.total_shares,
      remaining_approvals_needed: remaining,
      reason: data.reason,
      initiated_at: data.initiated_at,
      expires_at: data.expires_at,
      hours_remaining: hoursLeft,
      completed_at: data.completed_at,
    })
  )
}
