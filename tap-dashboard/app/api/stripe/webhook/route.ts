/**
 * Stripe Webhook Handler for Subscriptions
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for subscription lifecycle:
 * - checkout.session.completed: New subscription created
 * - invoice.paid: Successful recurring payment
 * - invoice.payment_failed: Failed payment (subscription past_due)
 * - customer.subscription.updated: Subscription status changes
 * - customer.subscription.deleted: Subscription canceled
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Events we handle for subscription lifecycle
const HANDLED_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
];

/**
 * POST handler for Stripe webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Validate signature header
  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Stripe Webhook] Signature verification failed:', errorMessage);
    return NextResponse.json(
      { error: 'Invalid signature', details: errorMessage },
      { status: 401 }
    );
  }

  // Log handled events
  if (HANDLED_EVENTS.includes(event.type)) {
    console.log(`[Stripe Webhook] ${event.type} received:`, {
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString(),
    });
  } else {
    // Acknowledge but ignore unhandled events
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }

  try {
    // Process the event
    const result = await handleWebhookEvent(event);

    console.log(`[Stripe Webhook] ${event.type} processed:`, {
      action: result.action,
      subscriptionId: result.subscriptionId,
      userId: result.userId,
    });

    return NextResponse.json(
      {
        received: true,
        handled: true,
        action: result.action,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);

    // Return 500 for transient errors so Stripe retries
    // Return 200 for expected errors we don't want retried
    const isStripeError = error instanceof Stripe.errors.StripeError;
    const statusCode = isStripeError ? (error.statusCode || 500) : 500;

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
 * Handle webhook events
 */
async function handleWebhookEvent(event: Stripe.Event): Promise<{
  action: string;
  subscriptionId?: string;
  userId?: string;
}> {
  const { type, data } = event;

  switch (type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(data.object as Stripe.Checkout.Session);

    case 'invoice.paid':
      return handleInvoicePaid(data.object as Stripe.Invoice);

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(data.object as Stripe.Invoice);

    case 'customer.subscription.created':
      return handleSubscriptionCreated(data.object as Stripe.Subscription);

    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(data.object as Stripe.Subscription);

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(data.object as Stripe.Subscription);

    case 'customer.subscription.paused':
      return handleSubscriptionPaused(data.object as Stripe.Subscription);

    case 'customer.subscription.resumed':
      return handleSubscriptionResumed(data.object as Stripe.Subscription);

    default:
      return { action: 'UNHANDLED' };
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle checkout.session.completed
 * Called when a customer successfully completes checkout
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const { subscription, customer, metadata } = session;
  const userId = metadata?.userId;
  const tier = metadata?.tier;

  if (!userId) {
    console.warn('[Stripe Webhook] No userId in session metadata');
  }

  console.log('[Stripe Webhook] Checkout completed:', {
    sessionId: session.id,
    subscriptionId: subscription,
    customerId: customer,
    userId,
    tier,
  });

  // TODO: Update database
  // - Create subscription record
  // - Update user's subscription status to 'active'
  // - Grant access to tier features

  return {
    action: 'CHECKOUT_COMPLETED',
    subscriptionId: subscription as string,
    userId,
  };
}

/**
 * Handle invoice.paid
 * Called for successful recurring payments
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  // Retrieve subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Invoice paid:', {
    invoiceId: invoice.id,
    subscriptionId,
    customerId,
    userId,
    amount: invoice.amount_paid,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
  });

  // TODO: Update database
  // - Record payment
  // - Update subscription period
  // - Ensure access remains active

  return {
    action: 'INVOICE_PAID',
    subscriptionId,
    userId,
  };
}

/**
 * Handle invoice.payment_failed
 * Called when a recurring payment fails
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  // Retrieve subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Invoice payment failed:', {
    invoiceId: invoice.id,
    subscriptionId,
    customerId,
    userId,
    amountDue: invoice.amount_due,
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: invoice.next_payment_attempt,
  });

  // TODO: Update database
  // - Mark subscription as past_due
  // - Notify user of payment failure
  // - Optionally restrict access after grace period

  // TODO: Send notification to user
  // - Email: Payment failed, update payment method

  return {
    action: 'INVOICE_PAYMENT_FAILED',
    subscriptionId,
    userId,
  };
}

/**
 * Handle customer.subscription.created
 */
async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Subscription created:', {
    subscriptionId: subscription.id,
    status: subscription.status,
    userId,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
  });

  // TODO: Create subscription record in database

  return {
    action: 'SUBSCRIPTION_CREATED',
    subscriptionId: subscription.id,
    userId,
  };
}

/**
 * Handle customer.subscription.updated
 * Handles status changes: active, past_due, unpaid, canceled, etc.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const userId = subscription.metadata?.userId;
  const status = subscription.status;

  console.log('[Stripe Webhook] Subscription updated:', {
    subscriptionId: subscription.id,
    status,
    userId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at,
  });

  // Handle different subscription statuses
  switch (status) {
    case 'active':
      // Subscription is active
      // TODO: Ensure user has full access
      break;

    case 'past_due':
      // Payment failed but within retry window
      // TODO: Notify user, potentially restrict access
      break;

    case 'unpaid':
      // Payment failed after all retries
      // TODO: Suspend access, notify user
      break;

    case 'canceled':
      // Subscription has been canceled
      // TODO: Schedule access removal at period end
      break;

    case 'paused':
      // Subscription is paused
      // TODO: Suspend access
      break;

    default:
      break;
  }

  // TODO: Update database with new status

  return {
    action: `SUBSCRIPTION_${status.toUpperCase()}`,
    subscriptionId: subscription.id,
    userId,
  };
}

/**
 * Handle customer.subscription.deleted
 * Called when subscription is canceled and period has ended
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Subscription deleted:', {
    subscriptionId: subscription.id,
    userId,
    endedAt: subscription.ended_at,
  });

  // TODO: Update database
  // - Mark subscription as canceled
  // - Remove access to paid features
  // - Optionally downgrade to free tier

  // TODO: Send notification
  // - Email: Subscription ended, consider re-subscribing

  return {
    action: 'SUBSCRIPTION_DELETED',
    subscriptionId: subscription.id,
    userId,
  };
}

/**
 * Handle customer.subscription.paused
 */
async function handleSubscriptionPaused(
  subscription: Stripe.Subscription
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Subscription paused:', {
    subscriptionId: subscription.id,
    userId,
  });

  // TODO: Suspend access during pause

  return {
    action: 'SUBSCRIPTION_PAUSED',
    subscriptionId: subscription.id,
    userId,
  };
}

/**
 * Handle customer.subscription.resumed
 */
async function handleSubscriptionResumed(
  subscription: Stripe.Subscription
): Promise<{ action: string; subscriptionId?: string; userId?: string }> {
  const userId = subscription.metadata?.userId;

  console.log('[Stripe Webhook] Subscription resumed:', {
    subscriptionId: subscription.id,
    userId,
  });

  // TODO: Restore access

  return {
    action: 'SUBSCRIPTION_RESUMED',
    subscriptionId: subscription.id,
    userId,
  };
}
