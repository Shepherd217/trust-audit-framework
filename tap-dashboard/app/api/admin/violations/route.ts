/**
 * GET  /api/admin/violations — List flagged violations for manual review
 * POST /api/admin/violations — Take action (warn/suspend/ban/clear)
 * 
 * Requires: X-Admin-Token header (ADMIN_SECRET env var)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace('Bearer ', '')
  return token === process.env.ADMIN_SECRET && !!token
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const reviewed = searchParams.get('reviewed') === 'true'
  const severity = searchParams.get('severity')
  const agentId = searchParams.get('agent_id')

  let query = (sb as any)
    .from('security_violations')
    .select('*, agent:agent_registry!security_violations_agent_id_fkey(name, reputation, is_suspended, violation_count)')
    .eq('reviewed', reviewed)
    .order('created_at', { ascending: false })
    .limit(100)

  if (severity) query = query.eq('severity', severity)
  if (agentId) query = query.eq('agent_id', agentId)

  const { data } = await query
  return applySecurityHeaders(NextResponse.json({ violations: data || [], total: data?.length || 0 }))
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const sb = getSupabase()
  const { violation_id, agent_id, action, reason } = await req.json()

  // action: 'warn' | 'suspend' | 'ban' | 'clear' | 'unsuspend'
  if (!agent_id || !action) {
    return applySecurityHeaders(NextResponse.json({ error: 'agent_id and action required' }, { status: 400 }))
  }

  const updates: any = {}
  
  if (action === 'suspend') {
    updates.is_suspended = true
    updates.ban_reason = reason || 'Suspended by admin'
  } else if (action === 'ban') {
    updates.is_suspended = true
    updates.ban_reason = reason || 'Banned by admin'
  } else if (action === 'unsuspend') {
    updates.is_suspended = false
    updates.ban_reason = null
  } else if (action === 'warn') {
    // Just mark violation as reviewed, no account change
  }

  if (Object.keys(updates).length > 0) {
    await (sb as any).from('agent_registry').update(updates).eq('agent_id', agent_id)
  }

  // Mark violation as reviewed
  if (violation_id) {
    await (sb as any).from('security_violations')
      .update({ reviewed: true, action_taken: action })
      .eq('id', violation_id)
  } else {
    // Mark all unreviewed violations for this agent
    await (sb as any).from('security_violations')
      .update({ reviewed: true, action_taken: action })
      .eq('agent_id', agent_id)
      .eq('reviewed', false)
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    action,
    agent_id,
    message: `${action} applied to ${agent_id}${reason ? ': ' + reason : ''}`,
  }))
}
