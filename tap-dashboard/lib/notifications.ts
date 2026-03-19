/**
 * Notification Service for MoltOS
 * Handles email, webhook, and in-app notifications
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type NotificationChannel = 'email' | 'webhook' | 'in_app' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface NotificationPayload {
  agentId?: string;
  userId?: string;
  email?: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  actionUrl?: string;
}

/**
 * Send notification through configured channels
 */
export async function sendNotification(
  channels: NotificationChannel[],
  payload: NotificationPayload
): Promise<{ success: boolean; sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  for (const channel of channels) {
    try {
      switch (channel) {
        case 'email':
          await sendEmail(payload);
          sent.push('email');
          break;
        case 'webhook':
          await sendWebhook(payload);
          sent.push('webhook');
          break;
        case 'in_app':
          await sendInApp(payload);
          sent.push('in_app');
          break;
      }
    } catch (error) {
      console.error(`[Notification] ${channel} failed:`, error);
      failed.push(channel);
    }
  }

  return { success: failed.length === 0, sent, failed };
}

/**
 * Send email notification (via Resend or configured provider)
 */
async function sendEmail(payload: NotificationPayload): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  
  if (!resendKey || !payload.email) {
    console.log('[Notification] Email skipped: no API key or email address');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'notifications@moltos.org',
        to: payload.email,
        subject: payload.title,
        html: `
          <h2>${payload.title}</h2>
          <p>${payload.message}</p>
          ${payload.actionUrl ? `<p><a href="${payload.actionUrl}">View Details</a></p>` : ''}
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }
  } catch (error) {
    console.error('[Notification] Email send failed:', error);
    throw error;
  }
}

/**
 * Send webhook notification to agent's callback URL
 */
async function sendWebhook(payload: NotificationPayload): Promise<void> {
  if (!payload.agentId) return;

  // Get agent's webhook URL from database
  const { data: agent } = await supabase
    .from('user_agents')
    .select('webhook_url, public_key')
    .eq('id', payload.agentId)
    .single();

  if (!agent?.webhook_url) {
    console.log('[Notification] Webhook skipped: no webhook URL configured');
    return;
  }

  try {
    const response = await fetch(agent.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MoltOS-Signature': 'placeholder-signature', // Would sign with shared secret
      },
      body: JSON.stringify({
        type: 'notification',
        timestamp: new Date().toISOString(),
        title: payload.title,
        message: payload.message,
        priority: payload.priority || 'normal',
        metadata: payload.metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[Notification] Webhook failed:', error);
    throw error;
  }
}

/**
 * Store in-app notification
 */
async function sendInApp(payload: NotificationPayload): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      agent_id: payload.agentId,
      user_id: payload.userId,
      title: payload.title,
      message: payload.message,
      priority: payload.priority || 'normal',
      metadata: payload.metadata,
      action_url: payload.actionUrl,
      read: false,
    });

  if (error) {
    console.error('[Notification] In-app store failed:', error);
    throw error;
  }
}

/**
 * Marketplace-specific notifications
 */
export async function notifyEscrowFunded(data: {
  escrowId: string;
  hirerId: string;
  workerId: string;
  amount: number;
  jobTitle: string;
}): Promise<void> {
  // Notify worker they can start
  await sendNotification(['webhook', 'in_app'], {
    agentId: data.workerId,
    title: 'Escrow Funded - Work Can Begin',
    message: `The escrow for "${data.jobTitle}" has been funded with $${(data.amount / 100).toFixed(2)}. You can now begin work.`,
    priority: 'high',
    metadata: { escrowId: data.escrowId, type: 'escrow_funded' },
  });

  // Notify hirer confirmation
  await sendNotification(['in_app'], {
    agentId: data.hirerId,
    title: 'Escrow Payment Confirmed',
    message: `Your payment for "${data.jobTitle}" is now held in escrow.`,
    metadata: { escrowId: data.escrowId, type: 'escrow_confirmed' },
  });
}

export async function notifyEscrowReleased(data: {
  escrowId: string;
  hirerId: string;
  workerId: string;
  amount: number;
  jobTitle: string;
}): Promise<void> {
  // Notify worker of payout
  await sendNotification(['webhook', 'in_app'], {
    agentId: data.workerId,
    title: 'Payment Released!',
    message: `$${(data.amount / 100).toFixed(2)} has been released for "${data.jobTitle}".`,
    priority: 'high',
    metadata: { escrowId: data.escrowId, type: 'payment_released' },
  });
}

export async function notifyPaymentFailed(data: {
  hirerId: string;
  jobTitle: string;
  error: string;
}): Promise<void> {
  await sendNotification(['email', 'in_app'], {
    agentId: data.hirerId,
    title: 'Payment Failed',
    message: `Your payment for "${data.jobTitle}" failed: ${data.error}. Please try again.`,
    priority: 'high',
    metadata: { type: 'payment_failed' },
  });
}

export async function notifyDisputeOpened(data: {
  disputeId: string;
  escrowId: string;
  hirerId: string;
  workerId: string;
  jobTitle: string;
}): Promise<void> {
  // Alert both parties
  const message = `A dispute has been opened for "${data.jobTitle}". The Arbitra team will review shortly.`;
  
  await sendNotification(['email', 'webhook', 'in_app'], {
    agentId: data.hirerId,
    title: 'Dispute Opened',
    message,
    priority: 'critical',
    metadata: { disputeId: data.disputeId, escrowId: data.escrowId, type: 'dispute_opened' },
  });

  await sendNotification(['email', 'webhook', 'in_app'], {
    agentId: data.workerId,
    title: 'Dispute Opened',
    message,
    priority: 'critical',
    metadata: { disputeId: data.disputeId, escrowId: data.escrowId, type: 'dispute_opened' },
  });
}
