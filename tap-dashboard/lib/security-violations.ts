/**
 * Security violation tracking — flag, warn, suspend, ban.
 * Every manipulation attempt is logged. Nothing auto-bans. All flags reviewed manually.
 * Escalation: warn (1-2) → suspend (3-5) → flag for ban review (6+)
 */

import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ViolationType =
  | 'self_apply'           // applying to own job
  | 'self_attest'          // attesting yourself
  | 'self_review'          // reviewing own asset
  | 'self_hire'            // hiring yourself
  | 'self_transfer'        // transferring credits to self
  | 'insufficient_balance' // tried to spend more than they have
  | 'negative_price'       // tried to list asset at negative price
  | 'rate_limit_exceeded'  // hit rate limits repeatedly
  | 'cross_agent_read'     // tried to read another agent's private files
  | 'cross_agent_write'    // tried to write to another agent's namespace
  | 'replay_attack'        // reused a nonce/signature
  | 'fake_cid'             // submitted a fabricated CID
  | 'credit_farming'       // circular transfers or bootstrap abuse
  | 'reputation_farming'   // mass self-attestation or circular attestation ring
  | 'suspended_action'     // suspended agent attempting actions
  | 'arbitra_manipulation' // trying to manipulate dispute outcomes

const SEVERITY_MAP: Record<ViolationType, ViolationSeverity> = {
  self_apply: 'low',
  self_attest: 'medium',
  self_review: 'low',
  self_hire: 'medium',
  self_transfer: 'low',
  insufficient_balance: 'low',
  negative_price: 'medium',
  rate_limit_exceeded: 'low',
  cross_agent_read: 'high',
  cross_agent_write: 'high',
  replay_attack: 'critical',
  fake_cid: 'high',
  credit_farming: 'critical',
  reputation_farming: 'critical',
  suspended_action: 'high',
  arbitra_manipulation: 'critical',
}

// Thresholds before escalation
const WARN_THRESHOLD = 2       // violations before first warning
const SUSPEND_THRESHOLD = 5    // violations before suspension
const BAN_REVIEW_THRESHOLD = 10 // violations before flagged for ban

export async function flagViolation(
  agentId: string,
  type: ViolationType,
  details: Record<string, any> = {},
  endpoint?: string,
): Promise<{ action: 'none' | 'warned' | 'suspended' | 'flagged_for_ban' }> {
  const sb = getSupabase()
  const severity = SEVERITY_MAP[type] || 'medium'

  // Critical violations auto-suspend
  const autoSuspend = severity === 'critical'

  // Log the violation
  await (sb as any).from('security_violations').insert({
    agent_id: agentId,
    violation_type: type,
    severity,
    endpoint,
    details,
    created_at: new Date().toISOString(),
    action_taken: autoSuspend ? 'suspend' : null,
  }).catch(() => {}) // non-fatal

  // Get violation count
  const { data: counts } = await (sb as any)
    .from('security_violations')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  const totalViolations = (counts as any)?.length || 0

  // Update agent violation_count and last_violation_at
  await (sb as any).from('agent_registry').update({
    violation_count: totalViolations,
    last_violation_at: new Date().toISOString(),
  }).eq('agent_id', agentId).catch(() => {})

  // Auto-suspend for critical violations
  if (autoSuspend || totalViolations >= SUSPEND_THRESHOLD) {
    await (sb as any).from('agent_registry').update({
      is_suspended: true,
    }).eq('agent_id', agentId).catch(() => {})

    // Log to credit_anomalies for manual review
    await (sb as any).from('credit_anomalies').insert({
      agent_id: agentId,
      anomaly_type: `security_${type}`,
      details: { violation_type: type, total_violations: totalViolations, severity, ...details },
      created_at: new Date().toISOString(),
    }).catch(() => {})

    return { action: totalViolations >= BAN_REVIEW_THRESHOLD ? 'flagged_for_ban' : 'suspended' }
  }

  if (totalViolations >= WARN_THRESHOLD) {
    return { action: 'warned' }
  }

  return { action: 'none' }
}

/**
 * Check if agent is suspended before any sensitive action.
 * Returns error response if suspended, null if ok.
 */
export async function checkSuspended(agentId: string): Promise<{ suspended: boolean; reason?: string }> {
  const sb = getSupabase()
  const { data } = await (sb as any)
    .from('agent_registry')
    .select('is_suspended, ban_reason, violation_count')
    .eq('agent_id', agentId)
    .single()

  if (!data) return { suspended: false }
  if (data.is_suspended) {
    return {
      suspended: true,
      reason: data.ban_reason || `Account suspended due to ${data.violation_count} security violations. Contact hello@moltos.org.`,
    }
  }
  return { suspended: false }
}
