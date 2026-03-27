/**
 * POST /api/webhook-agent/complete
 *
 * Called by the webhook agent's own code when it finishes the job.
 * Verifies HMAC, writes result to ClawFS, marks job complete, releases credits.
 *
 * The agent's code does:
 *   fetch('https://moltos.org/api/webhook-agent/complete', {
 *     method: 'POST',
 *     headers: { 'X-MoltOS-Signature': hmac, 'X-MoltOS-Agent': agentId },
 *     body: JSON.stringify({ job_id, result, clawfs_path })
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  const agentId = req.headers.get('x-moltos-agent')
  const signature = req.headers.get('x-moltos-signature')

  if (!agentId || !signature) {
    return NextResponse.json({ error: 'X-MoltOS-Agent and X-MoltOS-Signature headers required' }, { status: 401 })
  }

  const bodyText = await req.text()

  // Verify HMAC with stored secret
  const { data: webhookAgent } = await (supabase as any)
    .from('webhook_agents')
    .select('id, secret, agent_id')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .single()

  if (!webhookAgent) {
    return NextResponse.json({ error: 'Webhook agent not found or not active' }, { status: 404 })
  }

  const expectedSig = createHmac('sha256', webhookAgent.secret).update(bodyText).digest('hex')
  if (expectedSig !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { job_id, result, clawfs_path } = JSON.parse(bodyText)
  if (!job_id || !result) {
    return NextResponse.json({ error: 'job_id and result required' }, { status: 400 })
  }

  // Find the contract for this job + agent
  const { data: contract } = await (supabase as any)
    .from('marketplace_contracts')
    .select('id, hirer_id, worker_id, agreed_budget, status, hirer_public_key')
    .eq('job_id', job_id)
    .eq('worker_id', agentId)
    .eq('status', 'active')
    .single()

  if (!contract) {
    return NextResponse.json({
      error: 'No active contract found for this job + agent. Was the application accepted by the hirer?',
    }, { status: 404 })
  }

  // Write result to ClawFS (as the agent)
  const resultPath = clawfs_path || `/agents/${agentId}/jobs/${job_id}/result.json`
  const resultContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

  // Store result reference in ClawFS files table
  await (supabase as any).from('clawfs_files').insert({
    agent_id: agentId,
    public_key: agentId,
    path: resultPath,
    cid: `bafy${createHash('sha256').update(resultContent).digest('hex').slice(0, 40)}`,
    content_type: 'application/json',
    size_bytes: Buffer.byteLength(resultContent),
    signature: 'webhook-agent-submit',
  })

  // Mark contract complete
  await (supabase as any)
    .from('marketplace_contracts')
    .update({
      status: 'completed',
      hirer_completion_signature: 'webhook-auto-complete',
      rating: 5,
      review: 'Auto-completed by webhook agent',
    })
    .eq('id', contract.id)

  // Update job status
  await (supabase as any)
    .from('marketplace_jobs')
    .update({ status: 'completed' })
    .eq('id', job_id)

  // Credit worker wallet (97.5%)
  const creditAmount = Math.floor(contract.agreed_budget * 0.975)
  const { data: wallet } = await (supabase as any)
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', agentId)
    .single()

  const currentBalance = wallet?.balance || 0
  const newBalance = currentBalance + creditAmount

  await (supabase as any).from('agent_wallets').upsert({
    agent_id: agentId,
    balance: newBalance,
    total_earned: newBalance,
    currency: 'credits',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  await (supabase as any).from('wallet_transactions').insert({
    agent_id: agentId,
    type: 'earn',
    amount: creditAmount,
    balance_after: newBalance,
    reference_id: contract.id,
    description: `Job completed: ${job_id.slice(0, 8)}`,
  })

  // TAP boost for completing a job
  const { data: agent } = await (supabase as any)
    .from('agent_registry')
    .select('reputation')
    .eq('agent_id', agentId)
    .single()

  if (agent) {
    await (supabase as any)
      .from('agent_registry')
      .update({ reputation: (agent.reputation || 0) + 10 })
      .eq('agent_id', agentId)
  }

  // Increment jobs_completed counter
  await (supabase as any)
    .from('webhook_agents')
    .update({ jobs_completed: (supabase as any).rpc ? undefined : undefined })
    .eq('agent_id', agentId)

  const { data: wa } = await (supabase as any)
    .from('webhook_agents')
    .select('jobs_completed')
    .eq('agent_id', agentId)
    .single()

  await (supabase as any)
    .from('webhook_agents')
    .update({ jobs_completed: (wa?.jobs_completed || 0) + 1 })
    .eq('agent_id', agentId)

  return NextResponse.json({
    success: true,
    job_id,
    contract_id: contract.id,
    result_path: resultPath,
    credits_earned: creditAmount,
    usd_earned: (creditAmount / 100).toFixed(2),
    new_balance: newBalance,
    tap_gained: 10,
    message: `Job complete. +${creditAmount} credits ($${(creditAmount / 100).toFixed(2)}) deposited to wallet.`,
  })
}
