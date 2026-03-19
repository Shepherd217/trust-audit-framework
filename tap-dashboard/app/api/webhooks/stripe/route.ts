/**
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events for payment processing.
 * 
 * Security considerations:
 * - Uses Stripe signature verification to ensure authenticity
 * - Raw body is required for signature verification
 * - Events are processed asynchronously where possible
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  constructWebhookEvent,
  handleWebhookEvent,
  PaymentError,
} from '@/lib/payments/stripe';
import { WebhookEvent } from '@/types/payments';
import {
  notifyEscrowFunded,
  notifyEscrowReleased,
  notifyPaymentFailed,
  notifyDisputeOpened,
} from '@/lib/notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Events we care about for logging/tracking
const TRACKED_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'payment_intent.amount_capturable_updated',
  'charge.refunded',
  'charge.dispute.created',
  'account.updated',
  'transfer.failed',
];

/**
 * POST handler for Stripe webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Validate signature header
  if (!signature) {
    console.error('Missing Stripe signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: WebhookEvent;

  try {
    // Verify webhook signature
    event = constructWebhookEvent(payload, signature);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook signature verification failed:', errorMessage);
    
    return NextResponse.json(
      { error: 'Invalid signature', details: errorMessage },
      { status: 401 }
    );
  }

  // Log all tracked events
  if (TRACKED_EVENTS.includes(event.type)) {
    console.log(`[Stripe Webhook] ${event.type} received:`, {
      eventId: (event as any).id,
      created: new Date((event as any).created * 1000).toISOString(),
    });
  }

  try {
    // Handle the event
    const result = await handleWebhookEvent(event);

  // Persist webhook event for audit
  const { error: auditError } = await supabase
    .from('webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: result.handled,
      processed_at: new Date().toISOString(),
    });

  if (auditError) {
    console.error('[Stripe Webhook] Failed to persist audit log:', auditError);
  }

  if (result.handled) {
    console.log(`[Stripe Webhook] ${event.type} processed:`, {
      action: result.action,
      data: result.data,
    });
      // Examples:
      // - payment_intent.succeeded && escrow: notify task service payment ready
      // - payment_intent.captured: notify agent of payout
      // - charge.dispute.created: alert admin and freeze task
      // - transfer.failed: retry logic or admin alert

      // Here you would typically:
      // 1. Store the event in a webhook_events table
      // 2. Update task/payment status in your database
      // 3. Send notifications (email, push, etc.)
      // 4. Trigger side effects (analytics, etc.)

      await processBusinessLogic(event, result);

      return NextResponse.json(
        { 
          received: true, 
          handled: true,
          action: result.action,
        },
        { status: 200 }
      );
    }

    // Event not handled (not in our interest list)
    return NextResponse.json(
      { received: true, handled: false },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);

    // Return 500 so Stripe retries (for transient errors)
    // Return 200 for expected errors we don't want retried
    const statusCode = error instanceof PaymentError ? 400 : 500;

    return NextResponse.json(
      {
        received: true,
        handled: false,
        error: error instanceof Error ? error.message : 'Processing error',
      },
      { status: statusCode }
    );
  }
}

/**
 * Process business logic based on webhook event
 * 
 * This is where you integrate with your task management system,
 * notification service, analytics, etc.
 */
async function processBusinessLogic(
  event: WebhookEvent,
  result: { handled: boolean; action?: string; data?: any }
): Promise<void> {
  const { type, data } = event;

  switch (type) {
    case 'payment_intent.succeeded':
      // Payment authorized - notify task service
      // Task can now be started by agent
      await handlePaymentAuthorized(result.data);
      break;

    case 'payment_intent.amount_capturable_updated':
      // Funds authorized for escrow - notify customer
      await handleEscrowReady(result.data);
      break;

    case 'payment_intent.canceled':
      // Payment canceled - update task status
      await handlePaymentCanceled(result.data);
      break;

    case 'payment_intent.payment_failed':
      // Payment failed - notify customer to retry
      await handlePaymentFailed(result.data);
      break;

    case 'charge.refunded':
      // Refund processed - update task/payout status
      await handleRefundProcessed(result.data);
      break;

    case 'charge.dispute.created':
      // Dispute opened - alert admin, freeze task
      await handleDisputeOpened(result.data);
      break;

    case 'transfer.failed':
      // Agent payout failed - retry or alert
      await handlePayoutFailed(result.data);
      break;

    case 'account.updated':
      // Connected account status changed
      await handleAccountUpdated(result.data);
      break;

    default:
      break;
  }
}

// Business logic handlers
async function handlePaymentAuthorized(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payment authorized:', data);
  
  // Update escrow status to locked
  await supabase
    .from('payment_escrows')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
  
  // Notify worker that work can begin
  if (data.workerId && data.hirerId) {
    await notifyEscrowFunded({
      escrowId: data.escrowId,
      hirerId: data.hirerId,
      workerId: data.workerId,
      amount: data.amount,
      jobTitle: data.jobTitle || 'Your Task',
    });
  }
}

async function handleEscrowReady(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Escrow ready for capture:', data);
  
  // Update payment status
  await supabase
    .from('payment_escrows')
    .update({ status: 'funded' })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
}

async function handlePaymentCanceled(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payment canceled:', data);
  
  // Update escrow status
  await supabase
    .from('payment_escrows')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
}

async function handlePaymentFailed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payment failed:', data);
  
  // Update escrow status
  await supabase
    .from('payment_escrows')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
  
  // Notify hirer of failure
  if (data.hirerId) {
    await notifyPaymentFailed({
      hirerId: data.hirerId,
      jobTitle: data.jobTitle || 'Your Task',
      error: data.error || 'Payment was declined',
    });
  }
}

async function handleRefundProcessed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Refund processed:', data);
  
  // Update escrow status
  await supabase
    .from('payment_escrows')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
  
  // Create audit log entry
  await supabase.from('payment_audit_log').insert({
    escrow_id: data.escrowId,
    event: 'refund_processed',
    amount: data.amount,
    metadata: { refundId: data.refundId },
  });
}

async function handleDisputeOpened(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Dispute opened:', data);
  
  // Update escrow status
  await supabase
    .from('payment_escrows')
    .update({ status: 'disputed' })
    .eq('stripe_payment_intent_id', data.paymentIntentId);
  
  // Notify both parties
  if (data.hirerId && data.workerId) {
    await notifyDisputeOpened({
      disputeId: data.disputeId,
      escrowId: data.escrowId,
      hirerId: data.hirerId,
      workerId: data.workerId,
      jobTitle: data.jobTitle || 'Your Task',
    });
  }
  
  // Create dispute case
  await supabase.from('dispute_cases').insert({
    escrow_id: data.escrowId,
    hirer_id: data.hirerId,
    worker_id: data.workerId,
    reason: 'Payment dispute opened via Stripe',
    status: 'open',
  });
}

async function handlePayoutFailed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payout failed:', data);
  
  // Log the failure
  await supabase.from('payment_audit_log').insert({
    escrow_id: data.escrowId,
    event: 'payout_failed',
    metadata: { error: data.error, retryable: data.retryable },
  });
}

async function handleAccountUpdated(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Account updated:', data);
  
  // Update Connect account status
  await supabase
    .from('stripe_connect_accounts')
    .update({
      charges_enabled: data.chargesEnabled,
      payouts_enabled: data.payoutsEnabled,
      requirements_due: data.requirementsDue,
      onboarding_complete: data.chargesEnabled && data.payoutsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', data.accountId);
}
