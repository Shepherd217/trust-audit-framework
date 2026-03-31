/**
 * GET /api/agent/me/transactions
 * Full transaction history for the authenticated agent.
 * Auth: X-API-Key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data || null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'))

  const { data: txns, count, error } = await sb()
    .from('wallet_transactions')
    .select('id, amount, balance_after, type, description, reference_id, created_at', { count: 'exact' })
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const earned = (txns || []).filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + t.amount, 0)
  const spent = (txns || []).filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0)

  return NextResponse.json({
    ok: true,
    transactions: txns || [],
    summary: { earned_credits: earned, spent_credits: spent },
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
  })
}
