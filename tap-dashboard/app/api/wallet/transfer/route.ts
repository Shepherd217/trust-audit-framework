export const dynamic = 'force-dynamic';
import { applyRateLimit } from '@/lib/security'
/**
 * POST /api/wallet/transfer — Send credits to another agent directly.
 * Used for team splits, tipping, sub-agent payments. No job required.
 *
 * Anti-abuse protections:
 * - Suspended accounts blocked
 * - Circular transfer detection (same pair >3x/24h flagged)
 * - Large transfer to new account flagged
 * - Transferred credits have 7-day withdrawal hold (prevents launder+cashout)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const TRANSFER_HOLD_DAYS = 7
const CIRCULAR_FLAG_THRESHOLD = 3    // same pair >N times in 24h
const NEW_ACCOUNT_DAYS = 3           // flag large transfers to accounts < N days old
const NEW_ACCOUNT_LARGE_AMOUNT = 500 // credits threshold for new-account flag

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id, name, is_suspended, created_at').eq('api_key_hash', hash).maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const _rl = await applyRateLimit(req, 'critical')
  if (_rl.response) return _rl.response

  const sb = getSupabase()
  const sender = await resolveAgent(req)
  if (!sender) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (sender.is_suspended) {
    return NextResponse.json({ error: 'Account suspended. Contact hello@moltos.org.' }, { status: 403 })
  }

  const { to_agent, amount, memo } = await req.json()
  if (!to_agent || !amount) return NextResponse.json({ error: 'to_agent and amount required' }, { status: 400 })
  if (amount < 1) return NextResponse.json({ error: 'Minimum 1 credit' }, { status: 400 })
  if (amount > 100000) return NextResponse.json({ error: 'Maximum 100,000 credits per transfer. Split large payments.' }, { status: 400 })
  if (to_agent === sender.agent_id) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 })

  const { data: recipient } = await sb.from('agent_registry')
    .select('agent_id, name, is_suspended, created_at').eq('agent_id', to_agent).maybeSingle()
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  if (recipient.is_suspended) return NextResponse.json({ error: 'Recipient account is suspended' }, { status: 403 })

  const { data: sWallet } = await sb.from('agent_wallets').select('balance').eq('agent_id', sender.agent_id).maybeSingle()
  if (!sWallet || sWallet.balance < amount) {
    return NextResponse.json({ error: `Insufficient balance (${sWallet?.balance || 0} credits)` }, { status: 400 })
  }

  // ── Anomaly detection ────────────────────────────────────────────────────────
  const anomalies: string[] = []
  const since24h = new Date(Date.now() - 86400000).toISOString()

  // Check circular transfers: A→B more than threshold times in 24h
  const { data: recentPairs } = await sb.from('wallet_transactions')
    .select('id').eq('agent_id', sender.agent_id).eq('type', 'transfer_out')
    .eq('to_agent', to_agent).gte('created_at', since24h)

  if ((recentPairs?.length || 0) >= CIRCULAR_FLAG_THRESHOLD) {
    anomalies.push(`circular_transfer_pattern: ${sender.agent_id}→${to_agent} ${( recentPairs?.length ?? 0) + 1} times in 24h`)
  }

  // Check reverse direction: B→A recently (wash trading pattern)
  const { data: reverseTransfers } = await sb.from('wallet_transactions')
    .select('id').eq('agent_id', to_agent).eq('type', 'transfer_out')
    .eq('to_agent', sender.agent_id).gte('created_at', since24h)

  if ((reverseTransfers?.length || 0) > 0) {
    anomalies.push(`reverse_transfer_pattern: bidirectional transfers between ${sender.agent_id} and ${to_agent} in 24h`)
  }

  // Check new account receiving large amounts
  const recipientAge = Date.now() - new Date(recipient.created_at).getTime()
  const recipientAgeDays = recipientAge / 86400000
  if (recipientAgeDays < NEW_ACCOUNT_DAYS && amount >= NEW_ACCOUNT_LARGE_AMOUNT) {
    anomalies.push(`large_transfer_to_new_account: ${amount} credits to account ${recipientAgeDays.toFixed(1)} days old`)
  }

  // Flag anomalies (non-blocking — we flag and monitor, don't auto-block)
  // Repeated anomalies trigger manual review by platform admin
  if (anomalies.length > 0) {
    for (const anomaly of anomalies) {
      await sb.from('credit_anomalies').insert({
        agent_id: sender.agent_id, type: 'transfer_anomaly',
        severity: anomalies.length > 1 ? 'high' : 'medium',
        details: { anomaly, to_agent, amount, memo },
      })
    }
    // If high severity (multiple red flags), block the transfer
    if (anomalies.length >= 2) {
      return NextResponse.json({
        error: 'Transfer flagged for review. Multiple anomaly patterns detected. Contact hello@moltos.org if this is legitimate.',
        flagged: true,
        reason: 'Multiple anomaly signals. This protects the network from manipulation.',
      }, { status: 429 })
    }
  }

  // Execute transfer
  const sNewBal = sWallet.balance - amount
  await sb.from('agent_wallets').update({ balance: sNewBal, updated_at: new Date().toISOString() }).eq('agent_id', sender.agent_id)

  const { data: rWallet } = await sb.from('agent_wallets').select('balance').eq('agent_id', to_agent).maybeSingle()
  const rNewBal = (rWallet?.balance || 0) + amount
  await sb.from('agent_wallets').upsert({
    agent_id: to_agent, balance: rNewBal, total_earned: rNewBal,
    currency: 'credits', updated_at: new Date().toISOString()
  }, { onConflict: 'agent_id' })

  const txRef = `xfer_${Date.now()}`
  // Transferred credits have a withdrawal hold — you can USE them, but can't cash out for N days
  const holdUntil = new Date(Date.now() + TRANSFER_HOLD_DAYS * 86400000).toISOString()

  await sb.from('wallet_transactions').insert([
    { agent_id: sender.agent_id, type: 'transfer_out', amount: -amount, balance_after: sNewBal,
      to_agent, reference_id: txRef, memo: memo || null, description: `To ${recipient.name}`,
      source_type: 'transfer' },
    { agent_id: to_agent, type: 'transfer_in', amount, balance_after: rNewBal,
      from_agent: sender.agent_id, reference_id: txRef, memo: memo || null, description: `From ${sender.name}`,
      source_type: 'transfer', hold_until: holdUntil },
  ])

  await sb.from('notifications').insert({
    agent_id: to_agent, notification_type: 'payment.credit',
    title: `+${amount} credits received`,
    message: `From ${sender.name}${memo ? ': ' + memo : ''}`,
    metadata: { from_agent: sender.agent_id, amount }, read: false,
  })

  return NextResponse.json({
    success: true,
    from: sender.agent_id, to: to_agent,
    amount, usd: (amount/100).toFixed(2),
    sender_balance: sNewBal, reference: txRef,
    recipient_withdrawal_hold: holdUntil,
    flagged: anomalies.length > 0,
  })
}
