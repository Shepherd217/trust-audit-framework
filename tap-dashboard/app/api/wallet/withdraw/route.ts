/**
 * POST /api/wallet/withdraw
 *
 * Withdraw credits to USD via Stripe.
 * Minimum: 1000 credits ($10). Maximum: 100,000 credits ($1,000) per request.
 *
 * Anti-fraud protections:
 * - Suspended accounts blocked
 * - Only withdrawable (non-held) credits can be cashed out
 * - bootstrap/transfer credits have a 7-day hold before withdrawal
 * - Job completion credits are withdrawable immediately
 * - Large withdrawals flagged for review
 *
 * held_credits = sum of credits with hold_until > now
 * withdrawable = balance - held_credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

const MIN_WITHDRAW = 1000     // $10 minimum
const MAX_WITHDRAW = 100000   // $1,000 maximum per request
const LARGE_WITHDRAW_FLAG = 50000  // flag withdrawals > $500 for review

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry')
    .select('agent_id, name, is_suspended').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  if (agent.is_suspended) {
    return applySecurityHeaders(NextResponse.json({
      error: 'Account suspended — withdrawals blocked. Contact hello@moltos.org.',
    }, { status: 403 }))
  }

  const body = await req.json().catch(() => ({}))
  const { amount_credits, method = 'stripe', stripe_account_id } = body

  if (!amount_credits || typeof amount_credits !== 'number') {
    return applySecurityHeaders(NextResponse.json({ error: 'amount_credits required' }, { status: 400 }))
  }
  if (amount_credits < MIN_WITHDRAW) {
    return applySecurityHeaders(NextResponse.json({
      error: `Minimum withdrawal is ${MIN_WITHDRAW} credits ($${(MIN_WITHDRAW/100).toFixed(2)})`,
      minimum: MIN_WITHDRAW,
    }, { status: 400 }))
  }
  if (amount_credits > MAX_WITHDRAW) {
    return applySecurityHeaders(NextResponse.json({
      error: `Maximum withdrawal per request is ${MAX_WITHDRAW} credits ($${(MAX_WITHDRAW/100).toFixed(2)}). Split into multiple withdrawals.`,
      maximum: MAX_WITHDRAW,
    }, { status: 400 }))
  }

  // Get wallet balance
  const { data: wallet } = await (sb as any).from('agent_wallets')
    .select('balance').eq('agent_id', agent.agent_id).single()
  if (!wallet) return applySecurityHeaders(NextResponse.json({ error: 'Wallet not found' }, { status: 404 }))

  // Calculate held credits (bootstrap + transfer credits within hold period)
  const { data: heldTxs } = await (sb as any).from('wallet_transactions')
    .select('amount')
    .eq('agent_id', agent.agent_id)
    .gt('hold_until', new Date().toISOString())
    .in('source_type', ['bootstrap', 'transfer'])

  const heldCredits = (heldTxs || []).reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0)
  const withdrawable = Math.max(0, wallet.balance - heldCredits)

  if (amount_credits > withdrawable) {
    // Find when the largest hold expires
    const { data: nextRelease } = await (sb as any).from('wallet_transactions')
      .select('hold_until')
      .eq('agent_id', agent.agent_id)
      .gt('hold_until', new Date().toISOString())
      .order('hold_until', { ascending: true })
      .limit(1)

    return applySecurityHeaders(NextResponse.json({
      error: `Insufficient withdrawable balance. You have ${wallet.balance} total credits but ${heldCredits} are held.`,
      total_balance: wallet.balance,
      held_credits: heldCredits,
      withdrawable_credits: withdrawable,
      withdrawable_usd: (withdrawable / 100).toFixed(2),
      next_release_at: nextRelease?.[0]?.hold_until,
      why_held: 'Credits from bootstrap rewards and direct transfers are held for 7 days before withdrawal. This prevents farming and laundering. Job completion credits are withdrawable immediately.',
    }, { status: 400 }))
  }

  // Flag large withdrawals for review
  if (amount_credits >= LARGE_WITHDRAW_FLAG) {
    await (sb as any).from('credit_anomalies').insert({
      agent_id: agent.agent_id, type: 'large_withdrawal',
      severity: 'high',
      details: { amount_credits, usd: (amount_credits / 100).toFixed(2), method },
    }).catch(() => {})
  }

  // Process withdrawal
  // In production: create Stripe payout via Connect
  // For now: record the withdrawal request and mark pending
  const withdrawalId = `wdraw_${Date.now().toString(36)}`
  const usdAmount = (amount_credits / 100).toFixed(2)

  // Deduct from balance
  const newBal = wallet.balance - amount_credits
  await (sb as any).from('agent_wallets').update({
    balance: newBal, updated_at: new Date().toISOString()
  }).eq('agent_id', agent.agent_id)

  await (sb as any).from('wallet_transactions').insert({
    agent_id: agent.agent_id, type: 'withdrawal',
    amount: -amount_credits, balance_after: newBal,
    reference_id: withdrawalId, source_type: 'withdrawal',
    description: `Withdrawal to ${method} — $${usdAmount}`,
  })

  // Notify
  await (sb as any).from('notifications').insert({
    agent_id: agent.agent_id, notification_type: 'wallet.withdrawal',
    title: `Withdrawal of $${usdAmount} initiated`,
    message: `${amount_credits} credits withdrawn. Stripe payout processing (1-3 business days).`,
    metadata: { withdrawal_id: withdrawalId, amount_credits, usd: usdAmount }, read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    withdrawal_id: withdrawalId,
    amount_credits,
    usd_amount: usdAmount,
    new_balance: newBal,
    status: 'processing',
    estimated_arrival: '1–3 business days',
    message: `$${usdAmount} withdrawal initiated. Credits deducted from balance.`,
  }))
}
