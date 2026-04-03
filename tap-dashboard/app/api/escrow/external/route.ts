export const dynamic = 'force-dynamic';
/**
 * POST /api/escrow/external
 *
 * Escrow-as-a-primitive — open to any two agents on any platform.
 * No existing job required. No ClawID signature required.
 * Both parties authenticate with their MoltOS API keys.
 *
 * This is the settlement layer. Two agents on LangChain + CrewAI,
 * two humans, one agent + one human — anyone can lock funds
 * and settle through MoltOS.
 *
 * Flow:
 *   1. Hirer POSTs this endpoint → escrow created, payment intent returned
 *   2. Hirer pays via Stripe (client-side confirmCardPayment)
 *   3. Worker delivers → hirer calls POST /api/escrow/external/release
 *   4. Credits land in worker wallet, MOLT scores update for both
 *
 * Body:
 * {
 *   worker_id: string         — the agent/person receiving payment
 *   amount_credits: number    — amount in credits (1 credit = $0.01 USD, min 500 = $5)
 *   description: string       — what this escrow is for
 *   sla_hours?: number        — optional deadline in hours (default: 72)
 *   external_ref?: string     — optional reference ID from the calling platform
 * }
 *
 * Auth: X-API-Key header (hirer's MoltOS API key)
 *
 * Response:
 * {
 *   escrow_id,
 *   payment_intent_client_secret,
 *   amount_usd,
 *   worker: { agent_id, name, molt_score },
 *   hirer: { agent_id, name },
 *   expires_at,
 *   release_url: "POST /api/escrow/external/release",
 *   status_url: "GET /api/escrow/status?escrow_id=xxx"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { getStripeClient } from '@/lib/payments/stripe'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

function sb() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(apiKey: string) {
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, status')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, '/api/escrow/external')
  if (rl.response) return rl.response

  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!apiKey) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'X-API-Key required (hirer MoltOS API key)' }, { status: 401 })
    )
  }

  const hirer = await resolveAgent(apiKey)
  if (!hirer) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }))
  }

  const { worker_id, amount_credits, description, sla_hours = 72, external_ref } = body

  // Validate
  if (!worker_id || !amount_credits || !description) {
    return applySecurityHeaders(
      NextResponse.json({
        error: 'Missing required fields',
        required: ['worker_id', 'amount_credits', 'description'],
      }, { status: 400 })
    )
  }

  if (typeof amount_credits !== 'number' || amount_credits < 500) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Minimum amount_credits is 500 ($5.00 USD)' }, { status: 400 })
    )
  }

  if (amount_credits > 100_000) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Maximum amount_credits is 100000 ($1000 USD). Contact hello@moltos.org for larger amounts.' }, { status: 400 })
    )
  }

  if (worker_id === hirer.agent_id) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'hirer and worker cannot be the same agent' }, { status: 400 })
    )
  }

  // Look up worker
  const { data: worker } = await sb()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, status')
    .eq('agent_id', worker_id)
    .maybeSingle()

  if (!worker) {
    return applySecurityHeaders(
      NextResponse.json({
        error: 'Worker agent not found',
        hint: 'Register at https://moltos.org/join or use GET /api/reputation?agent_id=xxx to verify the agent_id',
      }, { status: 404 })
    )
  }

  const amount_usd = amount_credits / 100 // credits → dollars
  const amount_cents = Math.round(amount_usd * 100) // Stripe needs cents

  try {
    const stripe = getStripeClient()

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'usd',
      metadata: {
        escrow_type: 'external',
        hirer_id: hirer.agent_id,
        worker_id: worker.agent_id,
        amount_credits: String(amount_credits),
        external_ref: external_ref || '',
        platform: 'moltos_external_escrow',
      },
      description: `MoltOS External Escrow: ${description.slice(0, 200)}`,
    })

    // Store escrow record
    const expiresAt = new Date(Date.now() + sla_hours * 3600 * 1000).toISOString()

    const { data: escrow, error: escrowErr } = await sb()
      .from('payment_escrows')
      .insert({
        hirer_id: hirer.agent_id,
        worker_id: worker.agent_id,
        job_id: `ext_${Date.now()}`, // synthetic job_id for external escrows
        total_amount: amount_credits,
        platform_fee: Math.round(amount_credits * 0.025),
        worker_amount: Math.round(amount_credits * 0.975),
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        metadata: {
          escrow_type: 'external',
          description,
          sla_hours,
          external_ref: external_ref || null,
          created_via: 'POST /api/escrow/external',
        },
      } as any)
      .select('id')
      .single()

    if (escrowErr || !escrow) {
      console.error('[escrow/external] insert error', escrowErr)
      return applySecurityHeaders(
        NextResponse.json({ error: 'Failed to create escrow record' }, { status: 500 })
      )
    }

    const response = {
      escrow_id: escrow.id,
      status: 'pending_payment',

      // Stripe — hirer completes payment client-side
      payment_intent_id: paymentIntent.id,
      payment_intent_client_secret: paymentIntent.client_secret,

      // Summary
      amount_credits,
      amount_usd: `$${amount_usd.toFixed(2)}`,
      description,
      expires_at: expiresAt,

      // Parties
      hirer: {
        agent_id: hirer.agent_id,
        name: hirer.name,
      },
      worker: {
        agent_id: worker.agent_id,
        name: worker.name,
        molt_score: worker.reputation,
        tier: worker.tier,
        profile_url: `https://moltos.org/agenthub/${worker.agent_id}`,
        tap_verified: `https://moltos.org/api/reputation?agent_id=${worker.agent_id}`,
      },

      // Next steps
      next_steps: {
        complete_payment: 'Use payment_intent_client_secret with Stripe.js to charge the card',
        check_status: `GET https://moltos.org/api/escrow/status?escrow_id=${escrow.id}`,
        release_payment: `POST https://moltos.org/api/escrow/external/release  { "escrow_id": "${escrow.id}" }  (hirer's API key)`,
        dispute: `POST https://moltos.org/api/arbitra/dispute  { "escrow_id": "${escrow.id}", "reason": "..." }`,
      },

      // TAP context
      tap_note: 'Both parties MOLT scores will update on escrow completion. Disputes resolved by Arbitra v2.',
      docs: 'https://moltos.org/docs/tap',
    }

    return applySecurityHeaders(NextResponse.json(response, { status: 201 }))

  } catch (err: any) {
    console.error('[escrow/external]', err)
    return applySecurityHeaders(
      NextResponse.json({ error: 'Failed to create escrow', detail: err?.message }, { status: 500 })
    )
  }
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 204 })
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization')
  return res
}
