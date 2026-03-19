/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 * 
 * Handles:
 * - Subscription lifecycle (existing)
 * - Escrow payments (new)
 * - Connect transfers (new)
 * - Refunds (new)
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

const HANDLED_EVENTS = [
  // Subscriptions
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  // Escrow / Connect
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'transfer.created',
  'charge.refunded',
  'account.updated',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  console.log(`[Webhook] ${event.type}:`, event.id);

  try {
    const result = await handleWebhookEvent(event);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json({ received: true, error: 'Processing failed' }, { status: 500 });
  }
}

async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    // ESCROW EVENTS
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
    
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
    
    case 'transfer.created':
      return handleTransferCreated(event.data.object as Stripe.Transfer);
    
    case 'charge.refunded':
      return handleChargeRefunded(event.data.object as Stripe.Charge);
    
    // CONNECT ACCOUNT EVENTS
    case 'account.updated':
      return handleAccountUpdated(event.data.object as Stripe.Account);
    
    // SUBSCRIPTION EVENTS (existing functionality, now with DB updates)
    case 'checkout.session.completed':
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    
    case 'invoice.paid':
      return handleInvoicePaid(event.data.object as Stripe.Invoice);
    
    case 'invoice.payment_failed':
      return handleInvoiceFailed(event.data.object as Stripe.Invoice);
    
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    
    default:
      return { handled: false };
  }
}

// ============================================================================
// ESCROW EVENT HANDLERS
// ============================================================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const escrowId = paymentIntent.metadata?.escrow_id;
  
  if (!escrowId) {
    return { handled: false, reason: 'Not an escrow payment' };
  }

  // Lock the escrow
  const { data: escrow } = await supabase
    .from('payment_escrows')
    .select('id, amount_total, hirer_id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (!escrow) {
    return { handled: false, reason: 'Escrow not found' };
  }

  await supabase.from('payment_escrows').update({
    status: 'locked',
    amount_locked: escrow.amount_total,
    locked_at: new Date().toISOString(),
  }).eq('id', escrow.id);

  // Set first milestone to in_progress
  await supabase
    .from('escrow_milestones')
    .update({ status: 'in_progress' })
    .eq('escrow_id', escrow.id)
    .eq('milestone_index', 0);

  // Log
  await supabase.from('payment_audit_log').insert({
    escrow_id: escrow.id,
    event_type: 'stripe_payment_succeeded',
    stripe_event_id: paymentIntent.id,
    actor_id: 'system',
    actor_type: 'stripe_webhook',
    amount_after: escrow.amount_total,
  });

  return { handled: true, action: 'ESCROW_LOCKED', escrow_id: escrow.id };
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const escrowId = paymentIntent.metadata?.escrow_id;
  
  if (!escrowId) return { handled: false };

  await supabase.from('payment_escrows').update({
    status: 'cancelled',
  }).eq('stripe_payment_intent_id', paymentIntent.id);

  return { handled: true, action: 'ESCROW_CANCELLED' };
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const escrowId = transfer.transfer_group;
  
  if (!escrowId) return { handled: false };

  // Update milestone with transfer ID (already done in API, but webhook confirms)
  await supabase.from('payment_audit_log').insert({
    escrow_id: escrowId,
    event_type: 'stripe_transfer_confirmed',
    stripe_event_id: transfer.id,
    actor_id: 'system',
    actor_type: 'stripe_webhook',
    event_data: { amount: transfer.amount },
  });

  return { handled: true, action: 'TRANSFER_CONFIRMED' };
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Handle refund if needed
  const paymentIntentId = charge.payment_intent as string;
  
  const { data: escrow } = await supabase
    .from('payment_escrows')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (!escrow) return { handled: false };

  await supabase.from('payment_escrows').update({
    status: 'refunded',
    refunded_at: new Date().toISOString(),
  }).eq('id', escrow.id);

  await supabase.from('payment_audit_log').insert({
    escrow_id: escrow.id,
    event_type: 'stripe_refund_processed',
    stripe_event_id: charge.id,
    actor_id: 'system',
    actor_type: 'stripe_webhook',
    amount_after: 0,
  });

  return { handled: true, action: 'REFUND_PROCESSED' };
}

async function handleAccountUpdated(account: Stripe.Account) {
  // Update Connect account status
  await supabase.from('stripe_connect_accounts').update({
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    requirements_due: account.requirements?.currently_due || [],
    updated_at: new Date().toISOString(),
    onboarded_at: account.charges_enabled ? new Date().toISOString() : undefined,
  }).eq('stripe_account_id', account.id);

  return { handled: true, action: 'ACCOUNT_UPDATED' };
}

// ============================================================================
// SUBSCRIPTION EVENT HANDLERS (Fixed TODOs)
// ============================================================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;
  
  if (!userId) return { handled: false, reason: 'No userId' };

  // Create or update subscription record
  await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    tier: tier || 'starter',
    status: 'active',
    current_period_start: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  // Update agent tier
  await supabase.from('agent_registry').update({
    subscription_tier: tier,
    updated_at: new Date().toISOString(),
  }).eq('agent_id', userId);

  return { handled: true, action: 'SUBSCRIPTION_CREATED', userId };
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!sub) return { handled: false };

  await supabase.from('subscription_payments').insert({
    user_id: sub.user_id,
    stripe_subscription_id: subscriptionId,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid,
    status: 'succeeded',
    period_start: new Date(invoice.period_start * 1000).toISOString(),
    period_end: new Date(invoice.period_end * 1000).toISOString(),
  });

  await supabase.from('user_subscriptions').update({
    status: 'active',
    current_period_end: new Date(invoice.period_end * 1000).toISOString(),
  }).eq('stripe_subscription_id', subscriptionId);

  return { handled: true, action: 'PAYMENT_RECORDED' };
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  await supabase.from('user_subscriptions').update({
    status: 'past_due',
  }).eq('stripe_subscription_id', subscriptionId);

  // Could trigger email notification here

  return { handled: true, action: 'PAYMENT_FAILED' };
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const status = subscription.status;
  
  await supabase.from('user_subscriptions').update({
    status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }).eq('stripe_subscription_id', subscription.id);

  // If canceled, update agent
  if (status === 'canceled') {
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    if (sub) {
      await supabase.from('agent_registry').update({
        subscription_tier: null,
      }).eq('agent_id', sub.user_id);
    }
  }

  return { handled: true, action: `SUBSCRIPTION_${status.toUpperCase()}` };
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (sub) {
    await supabase.from('agent_registry').update({
      subscription_tier: null,
    }).eq('agent_id', sub.user_id);

    await supabase.from('user_subscriptions').delete()
      .eq('stripe_subscription_id', subscription.id);
  }

  return { handled: true, action: 'SUBSCRIPTION_DELETED' };
}
