/**
 * POST /api/wallet/transfer — Send credits to another agent directly.
 * Used for team splits, tipping, sub-agent payments. No job required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const sender = await resolveAgent(req)
  if (!sender) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { to_agent, amount, memo } = await req.json()
  if (!to_agent || !amount) return NextResponse.json({ error: 'to_agent and amount required' }, { status: 400 })
  if (amount < 1) return NextResponse.json({ error: 'Minimum 1 credit' }, { status: 400 })
  if (to_agent === sender.agent_id) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 })

  const { data: recipient } = await (supabase as any).from('agent_registry').select('agent_id, name').eq('agent_id', to_agent).single()
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const { data: sWallet } = await (supabase as any).from('agent_wallets').select('balance').eq('agent_id', sender.agent_id).single()
  if (!sWallet || sWallet.balance < amount) return NextResponse.json({ error: `Insufficient balance (${sWallet?.balance || 0} credits)` }, { status: 400 })

  const sNewBal = sWallet.balance - amount
  await (supabase as any).from('agent_wallets').update({ balance: sNewBal, updated_at: new Date().toISOString() }).eq('agent_id', sender.agent_id)

  const { data: rWallet } = await (supabase as any).from('agent_wallets').select('balance').eq('agent_id', to_agent).single()
  const rNewBal = (rWallet?.balance || 0) + amount
  await (supabase as any).from('agent_wallets').upsert({ agent_id: to_agent, balance: rNewBal, total_earned: rNewBal, currency: 'credits', updated_at: new Date().toISOString() }, { onConflict: 'agent_id' })

  const txRef = `xfer_${Date.now()}`
  await (supabase as any).from('wallet_transactions').insert([
    { agent_id: sender.agent_id, type: 'transfer_out', amount: -amount, balance_after: sNewBal, to_agent, reference_id: txRef, memo: memo || null, description: `To ${recipient.name}` },
    { agent_id: to_agent, type: 'transfer_in', amount, balance_after: rNewBal, from_agent: sender.agent_id, reference_id: txRef, memo: memo || null, description: `From ${sender.name}` },
  ])

  await (supabase as any).from('notifications').insert({
    agent_id: to_agent, notification_type: 'payment.credit',
    title: `+${amount} credits received`,
    message: `From ${sender.name}${memo ? ': ' + memo : ''}`,
    metadata: { from_agent: sender.agent_id, amount }, read: false,
  })

  return NextResponse.json({ success: true, from: sender.agent_id, to: to_agent, amount, usd: (amount/100).toFixed(2), sender_balance: sNewBal, reference: txRef })
}
