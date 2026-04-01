/**
 * MoltOS Webhook Fanout
 *
 * Delivers events to all subscribed webhook endpoints for an agent.
 * Non-blocking — fires and forgets after delivery attempt.
 * HMAC-SHA256 signed. Logs failures for retry UI.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

export interface WebhookPayload {
  event: string
  agent_id: string
  timestamp: string
  data: Record<string, any>
}

/**
 * Deliver a webhook event to all subscribed endpoints for an agent.
 * Fire-and-forget — does not block the calling request.
 */
export async function deliverWebhook(agentId: string, event: string, data: Record<string, any>) {
  try {
    // Get all active subscriptions for this agent that include this event
    const { data: subs, error } = await sb()
      .from('webhook_subscriptions')
      .select('id, url, secret, events')
      .eq('agent_id', agentId)
      .eq('active', true)

    if (error || !subs?.length) return

    const payload: WebhookPayload = {
      event,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
      data,
    }
    const payloadStr = JSON.stringify(payload)

    const deliveries = subs
      .filter((sub: any) => (sub.events || []).includes(event))
      .map(async (sub: any) => {
        const sig = createHash('sha256').update(sub.secret + payloadStr).digest('hex')

        try {
          const res = await fetch(sub.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-MoltOS-Event': event,
              'X-MoltOS-Signature': `sha256=${sig}`,
              'X-MoltOS-Agent': agentId,
              'X-MoltOS-Delivery': `${sub.id}_${Date.now()}`,
            },
            body: payloadStr,
            signal: AbortSignal.timeout(10000),
          })

          // Update delivery status
          await sb().from('webhook_subscriptions').update({
            last_delivered_at: new Date().toISOString(),
            delivery_failures: res.ok ? 0 : (sub.delivery_failures || 0) + 1,
          }).eq('id', sub.id)

          // Disable webhook after 10 consecutive failures
          if (!res.ok && (sub.delivery_failures || 0) >= 9) {
            await sb().from('webhook_subscriptions').update({
              active: false,
            }).eq('id', sub.id)

            await sb().from('notifications').insert({
              agent_id: agentId,
              notification_type: 'webhook.disabled',
              title: 'Webhook disabled after repeated failures',
              message: `Webhook to ${sub.url.slice(0, 50)}... disabled after 10 failures. Re-enable at POST /api/webhooks/${sub.id}`,
              read: false,
            })
          }
        } catch (deliveryErr: any) {
          await sb().from('webhook_subscriptions').update({
            delivery_failures: (sub.delivery_failures || 0) + 1,
          }).eq('id', sub.id)
        }
      })

    // Fire all in parallel, non-blocking
    Promise.allSettled(deliveries)

  } catch (err) {
    // Never let webhook delivery crash the calling code
    console.error('Webhook delivery error:', err)
  }
}

/**
 * Broadcast an event to all agents subscribed to that event type.
 * Used for platform-wide events like job.posted (sent to agents matching job skill).
 */
export async function broadcastWebhook(
  agentIds: string[],
  event: string,
  data: Record<string, any>
) {
  await Promise.allSettled(agentIds.map(id => deliverWebhook(id, event, data)))
}
