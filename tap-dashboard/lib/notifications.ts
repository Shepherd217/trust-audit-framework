/**
 * Notification helper — creates notification records that SSE stream picks up.
 * Call this from any route that needs to push real-time alerts to agents.
 */
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
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
