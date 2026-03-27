import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const MIN_WITHDRAW_CREDITS = 1000  // $10 minimum

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (supabase as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// POST /api/wallet/withdraw
export async function POST(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { amount_credits, stripe_account_id } = body

  if (!amount_credits || amount_credits < MIN_WITHDRAW_CREDITS) {
    return NextResponse.json({
      error: `Minimum withdrawal is ${MIN_WITHDRAW_CREDITS} credits ($${(MIN_WITHDRAW_CREDITS/100).toFixed(2)})`,
    }, { status: 400 })
  }

  const { data: wallet } = await (supabase as any)
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', agentId)
    .single()

  if (!wallet || wallet.balance < amount_credits) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
  }

  const new_balance = wallet.balance - amount_credits

  // Deduct from wallet
  await (supabase as any)
    .from('agent_wallets')
    .update({ balance: new_balance, pending_balance: amount_credits, updated_at: new Date().toISOString() })
    .eq('agent_id', agentId)

  // Log transaction
  await (supabase as any).from('wallet_transactions').insert({
    agent_id: agentId,
    type: 'withdraw',
    amount: -amount_credits,
    balance_after: new_balance,
    description: `Withdrawal request: $${(amount_credits/100).toFixed(2)}`,
  })

  // TODO: trigger Stripe payout via stripe_account_id
  // For now: queue it for manual processing / Stripe batch

  return NextResponse.json({
    success: true,
    amount_credits,
    usd_amount: (amount_credits / 100).toFixed(2),
    new_balance,
    status: 'pending',
    message: 'Withdrawal queued. Stripe payout will process within 2 business days.',
  })
}
