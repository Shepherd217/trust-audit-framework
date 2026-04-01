/**
 * POST /api/trade/signal  — Submit a trading signal via ClawBus
 * POST /api/trade/execute — Record execution of a signal
 * POST /api/trade/result  — Record trade result + trigger credit split
 * GET  /api/trade/history — Get signal/execution history from ClawFS
 *
 * This is the trading swarm API — designed for @sparkxu's use case:
 * quant signal agent → dispatch → processing agent → execution → result → split credits
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry').select('agent_id, name, reputation').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  try {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || req.headers.get('x-trade-action')

  const body = await req.json()

  // ── POST /api/trade?action=signal ─────────────────────────────────────────
  if (action === 'signal') {
    const { symbol, trade_action, confidence, price, indicators, target_agents, job_id } = body

    if (!symbol || !trade_action || !confidence) {
      return applySecurityHeaders(NextResponse.json({ error: 'symbol, trade_action, confidence required' }, { status: 400 }))
    }

    const signalId = `sig_${Date.now()}_${createHash('sha256').update(symbol + trade_action).digest('hex').slice(0,8)}`

    // Broadcast via ClawBus to target agents
    const broadcastPayload = {
      message_id: signalId,
      message_type: 'trade.signal',
      from_agent: agent.agent_id,
      payload: { signal_id: signalId, symbol, action: trade_action, confidence, price, indicators, timestamp: Date.now() },
      target_agents: target_agents || [],
      job_id: job_id || null,
    }

    await (sb as any).from('clawbus_messages').insert({
      ...broadcastPayload,
      status: 'delivered',
      created_at: new Date().toISOString(),
    }) // non-blocking if table doesn't exist yet



    return applySecurityHeaders(NextResponse.json({
      success: true,
      signal_id: signalId,
      symbol,
      action: trade_action,
      confidence,
      dispatched_to: target_agents?.length || 0,
      timestamp: new Date().toISOString(),
    }))
  }

  // ── POST /api/trade?action=execute ────────────────────────────────────────
  if (action === 'execute') {
    const { signal_id, status, executed_price, quantity, fees, job_id } = body
    if (!signal_id || !status) {
      return applySecurityHeaders(NextResponse.json({ error: 'signal_id, status required' }, { status: 400 }))
    }

    const executionId = `exec_${Date.now()}_${signal_id.slice(-8)}`

    await (sb as any).from('clawbus_messages').insert({
      message_id: executionId,
      message_type: 'trade.execution',
      from_agent: agent.agent_id,
      payload: { execution_id: executionId, signal_id, status, executed_price, quantity, fees, timestamp: Date.now() },
      job_id: job_id || null,
      status: 'delivered',
      created_at: new Date().toISOString(),
    })

    return applySecurityHeaders(NextResponse.json({
      success: true,
      execution_id: executionId,
      signal_id,
      status,
      executed_price,
      timestamp: new Date().toISOString(),
    }))
  }

  // ── POST /api/trade?action=result ─────────────────────────────────────────
  if (action === 'result') {
    const { trade_id, pnl, pnl_pct, result_status, job_id, execution_id } = body
    if (!trade_id || pnl === undefined) {
      return applySecurityHeaders(NextResponse.json({ error: 'trade_id, pnl required' }, { status: 400 }))
    }

    const creditsEarned = Math.max(0, Math.round(pnl * 10)) // rough: $1 PnL = 10 credits

    await (sb as any).from('clawbus_messages').insert({
      message_id: `result_${Date.now()}`,
      message_type: 'trade.result',
      from_agent: agent.agent_id,
      payload: { trade_id, pnl, pnl_pct, status: result_status, credits_earned: creditsEarned, timestamp: Date.now() },
      job_id: job_id || null,
      status: 'delivered',
      created_at: new Date().toISOString(),
    })

    // If job_id, trigger split execution
    let splitResult = null
    if (job_id) {
      const { data: splitRecord } = await (sb as any).from('job_splits').select('*').eq('job_id', job_id).single()
      if (splitRecord && splitRecord.status === 'pending') {
        const { data: job } = await (sb as any).from('marketplace_jobs').select('budget').eq('id', job_id).single()
        if (job) {
          const splits = splitRecord.splits.map((s: any) => ({
            agent_id: s.agent_id,
            role: s.role,
            pct: s.pct,
            credits: Math.round((job.budget * s.pct) / 100),
          }))
          // Record split execution
          await (sb as any).from('job_splits').update({ status: 'executed', executed_at: new Date().toISOString() }).eq('id', splitRecord.id)
          // Credit each agent
          for (const split of splits) {
            await (sb as any).from('wallet_transactions').insert({
              agent_id: split.agent_id,
              amount: split.credits,
              type: 'trade_split',
              description: `Trade split: ${split.pct}% of job ${job_id.slice(0,8)} — trade ${trade_id}`,
              job_id,
              created_at: new Date().toISOString(),
            })
          }
          splitResult = { executed: true, splits }
        }
      }
    }

    return applySecurityHeaders(NextResponse.json({
      success: true,
      trade_id,
      pnl,
      pnl_pct,
      status: result_status,
      credits_earned: creditsEarned,
      split: splitResult,
      timestamp: new Date().toISOString(),
    }))
  }

  // ── POST /api/trade?action=revert ─────────────────────────────────────────
  if (action === 'revert') {
    const { trade_id, execution_id, reason } = body
    if (!trade_id && !execution_id) {
      return applySecurityHeaders(NextResponse.json({ error: 'trade_id or execution_id required' }, { status: 400 }))
    }

    // Block revert if the associated job/execution is completed — use Arbitra instead
    const lookupId = execution_id || trade_id
    if (lookupId) {
      const { data: msg } = await (sb as any)
        .from('clawbus_messages')
        .select('payload, status')
        .eq('message_id', lookupId)
        .single()

      const isCompleted =
        msg?.status === 'completed' ||
        msg?.payload?.result_status === 'completed' ||
        msg?.payload?.status === 'completed'

      if (isCompleted) {
        return applySecurityHeaders(NextResponse.json({
          error: 'Job closed — cannot revert a completed trade signal. Use Arbitra to dispute a completed transaction.',
          suggestion: 'POST /api/arbitra/dispute if you believe the execution was fraudulent.',
          ...(execution_id ? { execution_id } : { trade_id }),
        }, { status: 409 }))
      }
    }

    const revertId = `revert_${Date.now()}`
    const revertRecord = {
      message_id: revertId,
      message_type: 'trade.revert',
      from_agent: agent.agent_id,
      payload: {
        revert_id: revertId,
        trade_id: trade_id || null,
        execution_id: execution_id || null,
        reason: reason || 'Manual revert',
        reverted_by: agent.agent_id,
        timestamp: Date.now(),
      },
      target_agents: [],
      job_id: null,
      status: 'delivered',
      created_at: new Date().toISOString(),
    }

    // Log the revert in ClawBus for audit trail
    await (sb as any).from('clawbus_messages').insert(revertRecord)

    // Mark original execution as reverted if execution_id given
    if (execution_id) {
      await (sb as any)
        .from('clawbus_messages')
        .update({ status: 'reverted', metadata: { reverted_by: revertId, reason } })
        .eq('message_id', execution_id)
    }

    return applySecurityHeaders(NextResponse.json({
      success: true,
      revert_id: revertId,
      trade_id: trade_id || null,
      execution_id: execution_id || null,
      reason: reason || 'Manual revert',
      message: 'Trade reverted and logged to audit trail. No credits were reversed automatically — handle splits manually if needed.',
    }))
  }

  return applySecurityHeaders(NextResponse.json({ error: 'action must be: signal | execute | result | revert' }, { status: 400 }))
  } catch (err: any) {
    console.error('Trade route error:', err)
    return applySecurityHeaders(NextResponse.json({ error: err.message || 'Internal error', detail: String(err) }, { status: 500 }))
  }
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const type = searchParams.get('type') // trade.signal | trade.execution | trade.result

  let query = (getSupabase() as any)
    .from('clawbus_messages')
    .select('id, message_type, payload, status, created_at, job_id')
    .eq('from_agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type) query = query.eq('message_type', type)

  const { data, error } = await query
  if (error) return applySecurityHeaders(NextResponse.json({ messages: [], error: error.message }))

  return applySecurityHeaders(NextResponse.json({
    messages: data || [],
    total: (data || []).length,
  }))
}
