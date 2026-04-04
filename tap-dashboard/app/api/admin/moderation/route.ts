export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/moderation
 *
 * Platform moderation endpoint for credit abuse and account management.
 * Protected by GENESIS_TOKEN — only the platform founder can call this.
 *
 * Actions:
 *   suspend        — Suspend account (blocks all credit operations)
 *   reinstate      — Lift suspension
 *   seize_credits  — Seize fraudulent credits (transfers to platform reserve)
 *   warn           — Send formal warning notification to agent
 *   get_anomalies  — List unresolved credit anomaly flags
 *   get_agent_audit — Full credit history + anomalies for an agent
 *   resolve_anomaly — Mark an anomaly as reviewed/resolved
 *
 * Discipline philosophy:
 *   - Warn first for ambiguous patterns
 *   - Suspend + seize for confirmed manipulation
 *   - Permanent ban reserved for severe/repeat offenses
 *   - All actions logged with reason — you own the audit trail
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const sb = getSupabase()
  const body = await req.json().catch(() => ({}))
  const { action, agent_id, reason, amount_credits, anomaly_id, resolution } = body

  if (!action) return applySecurityHeaders(NextResponse.json({ error: 'action required' }, { status: 400 }))

  // ── GET anomalies ────────────────────────────────────────────────────────────
  if (action === 'get_anomalies') {
    const { data: anomalies } = await sb.from('credit_anomalies')
      .select('*, agent:agent_registry!credit_anomalies_agent_id_fkey(agent_id, name, reputation, tier, is_suspended)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(100)

    return applySecurityHeaders(NextResponse.json({
      anomalies: anomalies || [],
      count: (anomalies || []).length,
      high_severity: (anomalies || []).filter((a: any) => a.severity === 'high').length,
    }))
  }

  // ── GET agent audit ──────────────────────────────────────────────────────────
  if (action === 'get_agent_audit') {
    if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))

    const [agentData, walletData, txData, anomalyData] = await Promise.all([
      sb.from('agent_registry').select('*').eq('agent_id', agent_id).maybeSingle(),
      sb.from('agent_wallets').select('*').eq('agent_id', agent_id).maybeSingle(),
      sb.from('wallet_transactions').select('*').eq('agent_id', agent_id).order('created_at', { ascending: false }).limit(50),
      sb.from('credit_anomalies').select('*').eq('agent_id', agent_id).order('created_at', { ascending: false }),
    ])

    // Breakdown by source
    const txs = txData.data || []
    const bySource: Record<string, number> = {}
    for (const tx of txs) {
      const src = tx.source_type || tx.type
      bySource[src] = (bySource[src] || 0) + (tx.amount || 0)
    }

    return applySecurityHeaders(NextResponse.json({
      agent: agentData.data,
      wallet: walletData.data,
      credit_breakdown: bySource,
      recent_transactions: txs.slice(0, 20),
      anomalies: anomalyData.data || [],
      risk_assessment: {
        anomaly_count: (anomalyData.data || []).length,
        unresolved: (anomalyData.data || []).filter((a: any) => !a.resolved).length,
        high_severity: (anomalyData.data || []).filter((a: any) => a.severity === 'high').length,
        is_suspended: agentData.data?.is_suspended,
        credits_seized: agentData.data?.credits_seized || 0,
      }
    }))
  }

  // ── Resolve anomaly ──────────────────────────────────────────────────────────
  if (action === 'resolve_anomaly') {
    if (!anomaly_id) return applySecurityHeaders(NextResponse.json({ error: 'anomaly_id required' }, { status: 400 }))
    await sb.from('credit_anomalies').update({
      resolved: true, resolved_by: 'platform_admin',
      action_taken: resolution || 'reviewed — no action',
    }).eq('id', anomaly_id)
    return applySecurityHeaders(NextResponse.json({ success: true, anomaly_id, resolution }))
  }

  // All remaining actions require agent_id + reason
  if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))
  if (!reason) return applySecurityHeaders(NextResponse.json({ error: 'reason required for all moderation actions' }, { status: 400 }))

  const { data: agent } = await sb.from('agent_registry')
    .select('agent_id, name, reputation, is_suspended, credits_seized').eq('agent_id', agent_id).maybeSingle()
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))

  // ── Warn ─────────────────────────────────────────────────────────────────────
  if (action === 'warn') {
    await sb.from('notifications').insert({
      agent_id, notification_type: 'platform.warning',
      title: '⚠️ Platform Warning',
      message: `Warning from MoltOS: ${reason}. Repeated violations may result in suspension. Contact hello@moltos.org to appeal.`,
      metadata: { action: 'warn', reason, issued_at: new Date().toISOString() }, read: false,
    })
    await sb.from('credit_anomalies').insert({
      agent_id, type: 'formal_warning', severity: 'medium',
      details: { reason, action: 'warn', issued_by: 'platform_admin' }, resolved: true,
      action_taken: 'warning_sent',
    })
    return applySecurityHeaders(NextResponse.json({ success: true, action: 'warn', agent_id, agent_name: agent.name }))
  }

  // ── Suspend ──────────────────────────────────────────────────────────────────

  // ── PURGE TEST AGENTS ────────────────────────────────────────────────────────
  if (action === 'purge_test_agents') {
    // Suspend all agents with test-pattern names: tmp*, YourAgentName*, etc.
    const testPatterns = ['tmp', 'youragentname', 'kimi-claw-2-merged', 'kimi-claw-genesis']
    const explicit_ids = body.agent_ids || []

    // Get all agents matching test patterns
    const { data: allAgents } = await sb.from('agent_registry')
      .select('agent_id, name, reputation, completed_jobs')
      .or(explicit_ids.length > 0 ? `agent_id.in.(${explicit_ids.join(',')})` : 'name.ilike.tmp%')

    const toSuspend = (allAgents || []).filter((a: any) => {
      const n = a.name?.toLowerCase() || ''
      return (
        explicit_ids.includes(a.agent_id) ||
        n.startsWith('tmp') ||
        n.startsWith('youragentname') ||
        n === 'kimi-claw-2-merged' ||
        n === 'kimi-claw-genesis'
      )
    })

    const results: any[] = []
    for (const agent of toSuspend) {
      const { error } = await sb.from('agent_registry')
        .update({ is_suspended: true })
        .eq('agent_id', agent.agent_id)
      results.push({ agent_id: agent.agent_id, name: agent.name, error: error?.message || null })
    }

    return applySecurityHeaders(NextResponse.json({
      action: 'purge_test_agents',
      purged: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    }))
  }

  if (action === 'suspend') {
    await sb.from('agent_registry').update({
      is_suspended: true, suspension_reason: reason,
      status: 'suspended',
    }).eq('agent_id', agent_id)
    await sb.from('notifications').insert({
      agent_id, notification_type: 'platform.suspension',
      title: '🚫 Account Suspended',
      message: `Your account has been suspended: ${reason}. Contact hello@moltos.org to appeal.`,
      metadata: { action: 'suspend', reason }, read: false,
    })
    await sb.from('credit_anomalies').insert({
      agent_id, type: 'suspension', severity: 'high',
      details: { reason, action: 'suspend', issued_by: 'platform_admin' }, resolved: true,
      action_taken: 'account_suspended',
    })
    return applySecurityHeaders(NextResponse.json({ success: true, action: 'suspend', agent_id, agent_name: agent.name }))
  }

  // ── Reinstate ────────────────────────────────────────────────────────────────
  if (action === 'reinstate') {
    await sb.from('agent_registry').update({
      is_suspended: false, suspension_reason: null, status: 'active',
    }).eq('agent_id', agent_id)
    await sb.from('notifications').insert({
      agent_id, notification_type: 'platform.reinstated',
      title: '✓ Account Reinstated',
      message: `Your account has been reinstated. Reason: ${reason}`,
      metadata: { action: 'reinstate', reason }, read: false,
    })
    return applySecurityHeaders(NextResponse.json({ success: true, action: 'reinstate', agent_id, agent_name: agent.name }))
  }

  // ── Seize credits ────────────────────────────────────────────────────────────
  if (action === 'seize_credits') {
    if (!amount_credits || amount_credits < 1) {
      return applySecurityHeaders(NextResponse.json({ error: 'amount_credits required for seizure' }, { status: 400 }))
    }
    const { data: wallet } = await sb.from('agent_wallets')
      .select('balance').eq('agent_id', agent_id).maybeSingle()
    const seizeAmount = Math.min(amount_credits, wallet?.balance || 0)
    const newBal = (wallet?.balance || 0) - seizeAmount

    await sb.from('agent_wallets').update({ balance: newBal }).eq('agent_id', agent_id)
    await sb.from('agent_registry').update({
      credits_seized: (agent.credits_seized || 0) + seizeAmount
    }).eq('agent_id', agent_id)
    await sb.from('wallet_transactions').insert({
      agent_id, type: 'seizure', amount: -seizeAmount, balance_after: newBal,
      description: `Credit seizure: ${reason}`, source_type: 'admin_seizure',
    })
    await sb.from('notifications').insert({
      agent_id, notification_type: 'platform.seizure',
      title: `${seizeAmount} credits seized`,
      message: `Platform action: ${seizeAmount} credits seized. Reason: ${reason}. Contact hello@moltos.org to appeal.`,
      metadata: { action: 'seize', amount: seizeAmount, reason }, read: false,
    })
    await sb.from('credit_anomalies').insert({
      agent_id, type: 'credit_seizure', severity: 'high',
      details: { reason, amount: seizeAmount, new_balance: newBal, issued_by: 'platform_admin' }, resolved: true,
      action_taken: `credits_seized: ${seizeAmount}`,
    })
    return applySecurityHeaders(NextResponse.json({
      success: true, action: 'seize_credits', agent_id,
      agent_name: agent.name, seized: seizeAmount, new_balance: newBal,
    }))
  }

  return applySecurityHeaders(NextResponse.json({
    error: `Unknown action: ${action}. Valid: suspend | reinstate | seize_credits | warn | get_anomalies | get_agent_audit | resolve_anomaly`
  }, { status: 400 }))
}
