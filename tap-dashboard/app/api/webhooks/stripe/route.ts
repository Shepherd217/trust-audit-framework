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
import {
  constructWebhookEvent,
  handleWebhookEvent,
  PaymentError,
} from '@/lib/payments/stripe';
import { WebhookEvent } from '@/types/payments';

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
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString(),
    });
  }

  try {
    // Handle the event
    const result = await handleWebhookEvent(event);

    if (result.handled) {
      console.log(`[Stripe Webhook] ${event.type} processed:`, {
        action: result.action,
        data: result.data,
      });

      // TODO: Persist webhook event to database for audit trail
      // TODO: Trigger business logic based on event type
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
  // TODO: Update task status in database
  // TODO: Notify agent that task can begin
  // TODO: Send confirmation email to customer
}

async function handleEscrowReady(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Escrow ready for capture:', data);
  // TODO: Notify customer that payment is held in escrow
  // TODO: Update payment status in database
}

async function handlePaymentCanceled(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payment canceled:', data);
  // TODO: Update task status to 'canceled'
  // TODO: Notify agent task is canceled
  // TODO: If work started, handle compensation
}

async function handlePaymentFailed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payment failed:', data);
  // TODO: Notify customer of payment failure
  // TODO: Provide retry link
}

async function handleRefundProcessed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Refund processed:', data);
  // TODO: Update task/payment status to 'refunded'
  // TODO: Notify agent of refund (adjust payout if needed)
  // TODO: Send confirmation to customer
}

async function handleDisputeOpened(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Dispute opened:', data);
  // TODO: Alert admin immediately
  // TODO: Freeze task and associated funds
  // TODO: Gather evidence for dispute response
}

async function handlePayoutFailed(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Payout failed:', data);
  // TODO: Retry transfer
  // TODO: Alert admin if retry fails
  // TODO: Update agent's pending balance
}

async function handleAccountUpdated(data: any): Promise<void> {
  console.log('[Webhook Business Logic] Account updated:', data);
  // TODO: Update agent's onboarding status
  // TODO: Notify agent if charges/payouts enabled
  // TODO: Alert admin if requirements past due
}
