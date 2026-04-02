export const dynamic = 'force-dynamic';
/**
 * POST /api/payment/stream — create a payment stream for a long-running job
 * GET  /api/payment/stream?contract_id=<id> — get stream status
 *
 * Instead of paying everything at the end, credits release on a schedule.
 * Good for jobs that run hours or days — removes trust barrier on both sides.
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

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

// POST — set up payment stream on an active contract
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contract_id, interval_hours, installments } = await req.json()
  if (!contract_id || !interval_hours) {
    return NextResponse.json({ error: 'contract_id and interval_hours required' }, { status: 400 })
  }

  // Verify hirer owns this contract
  const { data: contract } = await supabase
    .from('marketplace_contracts')
    .select('id, hirer_id, worker_id, agreed_budget, status, job_id')
    .eq('id', contract_id)
    .eq('hirer_id', agentId)
    .eq('status', 'active')
    .maybeSingle()

  if (!contract) return NextResponse.json({ error: 'Contract not found or not active' }, { status: 404 })

  const numInstallments = installments || Math.ceil(24 / interval_hours) || 4
  const creditsPerInterval = Math.floor(contract.agreed_budget * 0.975 / numInstallments)
  const firstRelease = new Date(Date.now() + interval_hours * 60 * 60 * 1000)

  const { data: stream, error } = await supabase
    .from('payment_streams')
    .insert({
      contract_id,
      job_id: contract.job_id,
      worker_id: contract.worker_id,
      hirer_id: agentId,
      total_credits: contract.agreed_budget,
      interval_hours,
      credits_per_interval: creditsPerInterval,
      credits_released: 0,
      next_release_at: firstRelease.toISOString(),
      status: 'active',
    })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    stream_id: stream.id,
    worker_id: contract.worker_id,
    total_credits: contract.agreed_budget,
    credits_per_interval: creditsPerInterval,
    interval_hours,
    installments: numInstallments,
    first_release: firstRelease.toISOString(),
    usd_per_interval: (creditsPerInterval / 100).toFixed(2),
    message: `Payment stream active. ${creditsPerInterval} credits ($${(creditsPerInterval/100).toFixed(2)}) released every ${interval_hours}h.`,
  })
}

// GET — stream status
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const contractId = searchParams.get('contract_id')
  if (!contractId) return NextResponse.json({ error: 'contract_id required' }, { status: 400 })

  const { data: stream } = await supabase
    .from('payment_streams')
    .select('*')
    .eq('contract_id', contractId)
    .maybeSingle()

  if (!stream) return NextResponse.json({ error: 'No stream found for this contract' }, { status: 404 })

  const pctReleased = Math.round((stream.credits_released / stream.total_credits) * 100)

  return NextResponse.json({
    ...stream,
    credits_remaining: stream.total_credits - stream.credits_released,
    pct_released: pctReleased,
    usd_released: (stream.credits_released / 100).toFixed(2),
    usd_remaining: ((stream.total_credits - stream.credits_released) / 100).toFixed(2),
  })
}
