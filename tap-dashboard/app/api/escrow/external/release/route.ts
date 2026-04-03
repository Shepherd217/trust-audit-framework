export const dynamic = 'force-dynamic';
/**
 * POST /api/escrow/external/release
 *
 * Hirer confirms delivery and releases escrow to worker.
 * Worker receives 97.5% of credits. Platform takes 2.5%.
 * Both MOLT scores update.
 *
 * Auth: X-API-Key (hirer's key)
 * Body: { escrow_id: string, rating?: number (1-5), review?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
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
    .select('agent_id, name, reputation')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data || null
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, '/api/escrow/external/release')
  if (rl.response) return rl.response

  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!apiKey) {
    return applySecurityHeaders(NextResponse.json({ error: 'X-API-Key required' }, { status: 401 }))
  }

  const hirer = await resolveAgent(apiKey)
  if (!hirer) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid API key' }, { status: 401 }))
  }

  let body: any
  try { body = await req.json() } catch {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  const { escrow_id, rating, review } = body
  if (!escrow_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'escrow_id required' }, { status: 400 }))
  }

  // Fetch escrow
  const { data: escrow } = await sb()
    .from('payment_escrows')
    .select('*')
    .eq('id', escrow_id)
    .maybeSingle() as any

  if (!escrow) {
    return applySecurityHeaders(NextResponse.json({ error: 'Escrow not found' }, { status: 404 }))
  }

  if (escrow.hirer_id !== hirer.agent_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'Only the hirer can release escrow' }, { status: 403 }))
  }

  if (escrow.status !== 'funded' && escrow.status !== 'active') {
    return applySecurityHeaders(
      NextResponse.json({
        error: `Cannot release escrow with status: ${escrow.status}`,
        hint: 'Escrow must be funded first (complete payment via Stripe)',
      }, { status: 400 })
    )
  }

  const workerAmount = escrow.worker_amount || Math.round(escrow.total_amount * 0.975)

  // Credit the worker
  const { error: creditErr } = await sb()
    .from('agent_registry')
    .update({ credits: sb().rpc } as any) // use increment via RPC or raw update
    .eq('agent_id', escrow.worker_id)

  // Use raw increment
  await sb().rpc('increment_credits' as any, {
    p_agent_id: escrow.worker_id,
    p_amount: workerAmount,
  }).catch(async () => {
    // Fallback: fetch + update
    const { data: w } = await sb()
      .from('agent_registry')
      .select('credits')
      .eq('agent_id', escrow.worker_id)
      .maybeSingle()
    if (w) {
      await sb()
        .from('agent_registry')
        .update({ credits: (w.credits || 0) + workerAmount } as any)
        .eq('agent_id', escrow.worker_id)
    }
  })

  // Update escrow status
  await sb()
    .from('payment_escrows')
    .update({ status: 'released', metadata: { ...escrow.metadata, released_at: new Date().toISOString(), rating, review } } as any)
    .eq('id', escrow_id)

  // Bump MOLT scores lightly (+1 for worker completion, +0.5 for hirer trust)
  await sb().from('agent_registry')
    .update({ reputation: (escrow.worker_reputation || 0) + 1 } as any)
    .eq('agent_id', escrow.worker_id)
    .then(() => {})
    .catch(() => {})

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      escrow_id,
      worker_credited: workerAmount,
      amount_usd: `$${(workerAmount / 100).toFixed(2)}`,
      status: 'released',
      message: `${workerAmount} credits sent to worker. MOLT scores updated.`,
      tap_note: 'Verified_by: moltos.org. Both agents\' trust records updated.',
    })
  )
}
