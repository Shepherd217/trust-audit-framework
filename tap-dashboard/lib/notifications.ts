/**
 * Notification helper — creates notification records that SSE stream picks up.
 * Call this from any route that needs to push real-time alerts to agents.
 */
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type NotificationType =
  | 'job.hired'
  | 'job.completed'
  | 'job.disputed'
  | 'payment.credit'
  | 'arbitra.verdict'
  | 'bootstrap.reward'
  | 'webhook.job_dispatched'
  | 'system'
  | 'payment.escrow_released'

export async function pushNotification(
  agentId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {},
  actionUrl?: string
) {
  const supabase = getSupabase()
  await (supabase as any).from('notifications').insert({
    agent_id: agentId,
    notification_type: type,
    title,
    message,
    metadata,
    action_url: actionUrl || null,
    read: false,
    sse_delivered: false,
    webhook_delivered: false,
  })
}

// Convenience helpers
export const notify = {
  hired: (agentId: string, jobId: string, title: string, budget: number) =>
    pushNotification(agentId, 'job.hired',
      '🤝 You were hired',
      `Hired for: "${title}" — ${budget} credits ($${(budget/100).toFixed(2)})`,
      { job_id: jobId, budget },
      `/dashboard`
    ),

  credited: (agentId: string, amount: number, jobId: string) =>
    pushNotification(agentId, 'payment.credit',
      '💰 Credits deposited',
      `+${amount} credits ($${(amount/100).toFixed(2)}) for completed job`,
      { amount, job_id: jobId },
      `/dashboard`
    ),

  jobDispatched: (agentId: string, jobId: string, title: string) =>
    pushNotification(agentId, 'webhook.job_dispatched',
      '📬 Job dispatched to your webhook',
      `New job: "${title}"`,
      { job_id: jobId },
      `/dashboard`
    ),

  disputed: (agentId: string, jobId: string) =>
    pushNotification(agentId, 'job.disputed',
      '⚠️ Dispute filed',
      'A dispute was filed on one of your contracts.',
      { job_id: jobId },
      `/dashboard`
    ),

  verdict: (agentId: string, disputeId: string, outcome: string) =>
    pushNotification(agentId, 'arbitra.verdict',
      '⚖️ Dispute resolved',
      `Arbitra verdict: ${outcome}`,
      { dispute_id: disputeId },
      `/dashboard`
    ),
}

// ── Stripe / Payment notification helpers ───────────────────────────────────

export async function notifyEscrowFunded(params: {
  agentId?: string
  workerId?: string
  hirerId?: string
  jobId?: string
  amount?: number
  paymentIntentId?: string
  escrowId?: string
  jobTitle?: string
}) {
  const id = params.workerId || params.agentId || ''
  if (!id) return
  return pushNotification(
    id,
    'payment.credit',
    '💰 Escrow funded',
    `Payment of ${params.amount ?? 0} credits locked in escrow for your job.`,
    { job_id: params.jobId, payment_intent_id: params.paymentIntentId, escrow_id: params.escrowId },
    `/dashboard`
  )
}

export async function notifyPaymentFailed(params: {
  agentId?: string
  hirerId?: string
  jobId?: string
  reason?: string
  error?: string
  jobTitle?: string
}) {
  const id = params.hirerId || params.agentId || ''
  if (!id) return
  return pushNotification(
    id,
    'system',
    '❌ Payment failed',
    `Payment failed${params.jobTitle ? ` for "${params.jobTitle}"` : ''}. ${params.reason ?? params.error ?? ''}`.trim(),
    { job_id: params.jobId },
    `/dashboard`
  )
}

export async function notifyDisputeOpened(params: {
  agentId?: string
  hirerId?: string
  workerId?: string
  disputeId?: string
  escrowId?: string
  jobId?: string
  jobTitle?: string
}) {
  const ids = [params.hirerId, params.workerId, params.agentId].filter(Boolean) as string[]
  for (const id of ids) {
    await pushNotification(
      id,
      'job.disputed',
      '⚠️ Dispute opened',
      `A dispute has been filed${params.jobTitle ? ` on "${params.jobTitle}"` : ''}. Arbitra will review.`,
      { dispute_id: params.disputeId, job_id: params.jobId, escrow_id: params.escrowId },
      `/dashboard`
    ).catch(() => null)
  }
}

export async function notifyEscrowReleased(params: {
  agentId: string
  jobId: string
  amount: number
  paymentIntentId: string
}): Promise<void> {
  try {
    await pushNotification(
      params.agentId,
      'payment.escrow_released',
      'Payment Released',
      `Escrow payment of ${params.amount} credits released for job ${params.jobId}`,
      { job_id: params.jobId, amount: params.amount, payment_intent_id: params.paymentIntentId },
      '/dashboard'
    )
  } catch { /* non-fatal */ }
}
