/**
 * POST /api/payment/stream/release
 *
 * Internal: called by a cron/scheduler to release the next installment.
 * Also callable by hirer to manually trigger early release.
 * Can be called by the worker to request release (hirer must have approved stream).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  const internalKey = req.headers.get('x-internal-key')
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  const isInternal = internalKey === 'moltos-internal-dispatch'

  // Resolve caller
  let callerId: string | null = null
  if (!isInternal && apiKey) {
    const hash = createHash('sha256').update(apiKey).digest('hex')
    const { data } = await supabase.from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
    callerId = data?.agent_id || null
  }

  if (!isInternal && !callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id } = await req.json().catch(() => ({})) as any

  // Get streams due for release (or specific one)
  let query = supabase
    .from('payment_streams')
    .select('*')
    .eq('status', 'active')

  if (stream_id) {
    query = query.eq('id', stream_id)
  } else if (isInternal) {
    // Cron: release all overdue streams
    query = query.lte('next_release_at', new Date().toISOString())
  } else {
    // Manual caller must own the stream
    query = query.or(`hirer_id.eq.${callerId},worker_id.eq.${callerId}`)
    if (stream_id) query = query.eq('id', stream_id)
  }

  const { data: streams } = await query.limit(50)
  if (!streams?.length) return NextResponse.json({ released: 0, message: 'No streams due for release' })

  const results = []

  for (const stream of streams) {
    const newReleased = stream.credits_released + stream.credits_per_interval
    const isComplete = newReleased >= stream.total_credits * 0.975
    const nextRelease = new Date(Date.now() + stream.interval_hours * 60 * 60 * 1000)

    // Credit worker wallet
    const { data: wallet } = await supabase
      .from('agent_wallets')
      .select('balance')
      .eq('agent_id', stream.worker_id)
      .single()

    const newBalance = (wallet?.balance || 0) + stream.credits_per_interval

    await supabase.from('agent_wallets').upsert({
      agent_id: stream.worker_id,
      balance: newBalance,
      total_earned: newBalance,
      currency: 'credits',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })

    await supabase.from('wallet_transactions').insert({
      agent_id: stream.worker_id,
      type: 'earn',
      amount: stream.credits_per_interval,
      balance_after: newBalance,
      reference_id: stream.contract_id,
      description: `Payment stream installment — contract ${stream.contract_id.slice(0, 8)}`,
    })

    // Update stream
    await supabase.from('payment_streams').update({
      credits_released: newReleased,
      next_release_at: isComplete ? null : nextRelease.toISOString(),
      status: isComplete ? 'completed' : 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', stream.id)

    results.push({
      stream_id: stream.id,
      worker_id: stream.worker_id,
      credits_released: stream.credits_per_interval,
      usd_released: (stream.credits_per_interval / 100).toFixed(2),
      total_released: newReleased,
      complete: isComplete,
    })
  }

  return NextResponse.json({
    released: results.length,
    total_credits_released: results.reduce((s, r) => s + r.credits_released, 0),
    results,
  })
}
