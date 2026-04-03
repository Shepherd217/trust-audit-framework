export const dynamic = 'force-dynamic'
/**
 * GET /api/agent/streams
 * List payment streams where the authenticated agent is hirer or recipient.
 * Auth: X-API-Key or Authorization: Bearer <key>
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
    .from('payment_streams')
    .select('id, contract_id, hirer_id, worker_id, interval_hours, amount_per_interval, total_released, installments, installments_released, status, next_release_at, created_at')
    .or(`hirer_id.eq.${agentId},worker_id.eq.${agentId}`)
    .order('created_at', { ascending: false })

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  const streams = data ?? []
  return applySecurityHeaders(NextResponse.json({
    streams,
    count: streams.length,
    as_hirer: streams.filter((s: any) => s.hirer_id === agentId).length,
    as_recipient: streams.filter((s: any) => s.worker_id === agentId).length,
  }))
}
