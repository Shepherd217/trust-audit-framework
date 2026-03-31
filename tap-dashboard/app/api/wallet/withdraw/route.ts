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

  // Process withdrawal via Stripe Connect
  const withdrawalId = `wdraw_${Date.now().toString(36)}`
  const usdAmount = (amount_credits / 100).toFixed(2)
  const usdCents = amount_credits // 1 credit = $0.01

  let stripeTransferId: string | null = null
  let stripeStatus = 'processing'
  let stripeError: string | null = null

  if (method === 'stripe') {
    try {
      // Resolve Stripe Connect account
      let connectAccountId = stripe_account_id
      if (!connectAccountId) {
        const { data: connectAccount } = await (sb as any).from('stripe_connect_accounts')
          .select('stripe_account_id, charges_enabled, payouts_enabled')
          .eq('agent_id', agent.agent_id)
          .single()

        if (!connectAccount) {
          return applySecurityHeaders(NextResponse.json({
            error: 'No Stripe Connect account found. Onboard first at POST /api/stripe/connect/onboard',
            onboard_url: '/api/stripe/connect/onboard',
          }, { status: 400 }))
        }

        if (!connectAccount.payouts_enabled) {
          return applySecurityHeaders(NextResponse.json({
            error: 'Stripe Connect account not fully onboarded. Complete onboarding to enable payouts.',
            account_id: connectAccount.stripe_account_id,
            onboard_url: '/api/stripe/connect/onboard',
          }, { status: 400 }))
        }

        connectAccountId = connectAccount.stripe_account_id
      }

      // Create Stripe transfer to connected account
      const stripe = (await import('stripe')).default
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })

      const transfer = await stripeClient.transfers.create({
        amount: usdCents,
        currency: 'usd',
        destination: connectAccountId,
        metadata: {
          agent_id: agent.agent_id,
          withdrawal_id: withdrawalId,
          credits: amount_credits.toString(),
        },
        description: `MoltOS withdrawal — ${amount_credits} credits (${usdAmount})`,
      })

      stripeTransferId = transfer.id
      stripeStatus = 'completed' // Stripe transfers are typically instant to the connected account
    } catch (stripeErr: any) {
      console.error('Stripe transfer error:', stripeErr)
      stripeError = stripeErr?.message || 'Stripe transfer failed'
      stripeStatus = 'failed'
      // Don't deduct balance if Stripe failed
      return applySecurityHeaders(NextResponse.json({
        error: 'Stripe transfer failed',
        stripe_error: stripeError,
        withdrawal_id: withdrawalId,
        retry: true,
      }, { status: 500 }))
    }
  }

  // Deduct from balance (only after successful Stripe transfer or non-Stripe method)
  const newBal = wallet.balance - amount_credits
  await (sb as any).from('agent_wallets').update({
    balance: newBal, updated_at: new Date().toISOString()
  }).eq('agent_id', agent.agent_id)

  await (sb as any).from('wallet_transactions').insert({
    agent_id: agent.agent_id, type: 'withdrawal',
    amount: -amount_credits, balance_after: newBal,
    reference_id: withdrawalId, source_type: 'withdrawal',
    description: `Withdrawal to ${method} — ${usdAmount}${stripeTransferId ? ` (${stripeTransferId})` : ''}`,
  })

  // Notify
  const isComplete = stripeStatus === 'completed'
  const notifMsg = isComplete
    ? `${amount_credits} credits withdrawn. ${usdAmount} transferred to your Stripe account (${stripeTransferId}).`
    : `${amount_credits} credits withdrawn. Payout processing (1-3 business days).`

  await (sb as any).from('notifications').insert({
    agent_id: agent.agent_id, notification_type: 'wallet.withdrawal',
    title: `Withdrawal of ${usdAmount} ${isComplete ? 'completed' : 'initiated'}`,
    message: notifMsg,
    metadata: {
      withdrawal_id: withdrawalId,
      amount_credits,
      usd: usdAmount,
      stripe_transfer_id: stripeTransferId,
      method,
    },
    read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    withdrawal_id: withdrawalId,
    amount_credits,
    usd_amount: usdAmount,
    new_balance: newBal,
    new_balance_usd: `${(newBal / 100).toFixed(2)}`,
    status: stripeStatus,
    stripe_transfer_id: stripeTransferId,
    method,
    estimated_arrival: isComplete ? 'Transferred — payout to bank in 1-2 business days' : '1–3 business days',
    message: `${usdAmount} withdrawal ${isComplete ? 'completed' : 'initiated'}. Credits deducted from balance.`,
  }))
}
