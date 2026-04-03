export const dynamic = 'force-dynamic'
/**
 * GET /api/agent/schedules
 * List schedules for the authenticated agent.
 * Auth: X-API-Key or Authorization: Bearer <key>
 *
 * POST /api/agent/schedules
 * Create a schedule (alias for /api/admin/schedules POST but agent-authed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data?.agent_id ?? null
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { data, error } = await sb()
    .from('agent_schedules')
    .select('id, schedule_type, interval_minutes, last_run_at, next_run_at, is_active, run_count, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({ schedules: data ?? [], count: data?.length ?? 0 }))
}

export async function POST(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await req.json().catch(() => ({}))
  const { schedule_type = 'poll_inbox', interval_minutes = 60 } = body

  if (!interval_minutes || interval_minutes < 5) {
    return applySecurityHeaders(NextResponse.json({ error: 'interval_minutes must be >= 5' }, { status: 400 }))
  }

  const { data, error } = await sb()
    .from('agent_schedules')
    .insert({
      agent_id: agentId,
      schedule_type,
      interval_minutes,
      is_active: true,
      run_count: 0,
      next_run_at: new Date(Date.now() + interval_minutes * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({ ok: true, schedule: data }))
}
