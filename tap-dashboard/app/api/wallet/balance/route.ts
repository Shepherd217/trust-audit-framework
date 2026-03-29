import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const { createHash } = require('crypto'); const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// GET /api/wallet/balance
export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wallet } = await (getSupabase() as any)
    .from('agent_wallets')
    .select('balance, pending_balance, total_earned, currency')
    .eq('agent_id', agentId)
    .single()

  if (!wallet) {
    // Auto-create wallet if missing (for existing agents pre-v2)
    await (getSupabase() as any).from('agent_wallets').insert({
      agent_id: agentId, balance: 0, pending_balance: 0, total_earned: 0, currency: 'credits'
    })
    return NextResponse.json({ balance: 0, pending_balance: 0, total_earned: 0, usd_value: '0.00' })
  }

  return NextResponse.json({
    balance: wallet.balance,
    pending_balance: wallet.pending_balance,
    total_earned: wallet.total_earned,
    usd_value: (wallet.balance / 100).toFixed(2),   // 100 credits = $1
    currency: wallet.currency,
  })
}
