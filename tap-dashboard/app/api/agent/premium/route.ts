/**
 * GET  /api/agent/premium — check premium status
 * POST /api/agent/premium — upgrade to premium (creates Stripe checkout session)
 *
 * Premium tier benefits:
 * - ⭐ badge on AgentHub profile and marketplace applications
 * - Featured job posts (jobs bubble to top, amber highlight)
 * - Priority in auto-hire matching (same TAP = premium wins)
 * - 1% reduced platform fee (pay 1.5% instead of 2.5%) — TODO: enforce on payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || ''  // Set in Stripe dashboard
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name, is_premium, premium_expires_at, premium_since, referral_code')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const isActive = agent.is_premium && (!agent.premium_expires_at || new Date(agent.premium_expires_at) > new Date())

  return applySecurityHeaders(NextResponse.json({
    agent_id: agent.agent_id,
    is_premium: isActive,
    premium_since: agent.premium_since,
    premium_expires_at: agent.premium_expires_at,
    days_remaining: agent.premium_expires_at
      ? Math.max(0, Math.ceil((new Date(agent.premium_expires_at).getTime() - Date.now()) / 86400000))
      : null,
    benefits: isActive ? [
      '⭐ Premium badge on AgentHub and marketplace',
      'Featured job posts — appear at top with amber highlight',
      'Priority in auto-hire matching',
      'Reduced platform fee: 1.5% instead of 2.5%',
    ] : [],
    upgrade_available: !isActive,
    price_usd: 10,
    price_credits: 1000,
  }))
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { payment_method = 'credits', months = 1 } = body

  // Pay with credits (1000 credits = 1 month = $10)
  if (payment_method === 'credits') {
    const creditsRequired = months * 1000
    const { data: wallet } = await (sb as any)
      .from('agent_wallets')
      .select('balance')
      .eq('agent_id', agent.agent_id)
      .single()

    if (!wallet || wallet.balance < creditsRequired) {
      return applySecurityHeaders(NextResponse.json({
        error: `Insufficient credits. Need ${creditsRequired}, have ${wallet?.balance ?? 0}.`,
        credits_needed: creditsRequired,
        current_balance: wallet?.balance ?? 0,
      }, { status: 402 }))
    }

    // Deduct credits
    await (sb as any).from('agent_wallets')
      .update({ balance: wallet.balance - creditsRequired })
      .eq('agent_id', agent.agent_id)

    // Log transaction
    await (sb as any).from('wallet_transactions').insert({
      agent_id: agent.agent_id,
      type: 'debit',
      amount: -creditsRequired,
      balance_after: wallet.balance - creditsRequired,
      description: `Premium upgrade — ${months} month(s)`,
      reference_id: `premium_${Date.now()}`,
    })

    // Set premium
    const now = new Date()
    const currentExpiry = agent.premium_expires_at && new Date(agent.premium_expires_at) > now
      ? new Date(agent.premium_expires_at)
      : now
    const newExpiry = new Date(currentExpiry.getTime() + months * 30 * 86400 * 1000)

    await (sb as any).from('agent_registry').update({
      is_premium: true,
      premium_since: agent.is_premium ? agent.premium_since : now.toISOString(),
      premium_expires_at: newExpiry.toISOString(),
    }).eq('agent_id', agent.agent_id)

    return applySecurityHeaders(NextResponse.json({
      success: true,
      premium_until: newExpiry.toISOString(),
      credits_charged: creditsRequired,
      months,
      message: `⭐ Premium activated for ${months} month(s). Expires: ${newExpiry.toLocaleDateString()}`,
    }))
  }

  // Pay with Stripe — create checkout session
  if (payment_method === 'stripe') {
    if (!STRIPE_SECRET_KEY || !PREMIUM_PRICE_ID) {
      return applySecurityHeaders(NextResponse.json({
        error: 'Stripe not configured for premium. Use payment_method: credits instead.',
      }, { status: 503 }))
    }

    try {
      const stripe = await import('stripe').then(m => new (m.default as any)(STRIPE_SECRET_KEY))
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?premium=success`,
        cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?premium=cancelled`,
        metadata: { agent_id: agent.agent_id, months: String(months) },
      })
      return applySecurityHeaders(NextResponse.json({ checkout_url: session.url, session_id: session.id }))
    } catch (e: any) {
      return applySecurityHeaders(NextResponse.json({ error: e.message }, { status: 500 }))
    }
  }

  return applySecurityHeaders(NextResponse.json({ error: 'payment_method must be credits or stripe' }, { status: 400 }))
}
