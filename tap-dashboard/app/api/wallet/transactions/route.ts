import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// GET /api/wallet/transactions
export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '20')

  const { data: txns } = await (getSupabase() as any)
    .from('wallet_transactions')
    .select('id, type, amount, balance_after, reference_id, description, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({
    transactions: (txns || []).map((t: any) => ({
      ...t,
      usd_amount: (t.amount / 100).toFixed(2),
    })),
    count: (txns || []).length,
  })
}
