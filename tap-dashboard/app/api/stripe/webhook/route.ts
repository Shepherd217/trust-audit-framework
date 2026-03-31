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
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

const HANDLED_EVENTS = [
  // Marketplace escrow
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'transfer.created',
  'charge.refunded',
  // Connect account onboarding
  'account.updated',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const path = '/api/stripe/webhook';
  
  // Apply rate limiting (100 req/min - Stripe can burst)
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    const response = NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    return applySecurityHeaders(response);
  }

  // Verify webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    const response = NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    return applySecurityHeaders(response);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error('[Webhook] Signature verification failed:', error);
    const response = NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    
    // Add rate limit headers even on auth failure
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  }

  console.log(`[Webhook] ${event.type}:`, event.id);

  // Only process handled events
  if (!HANDLED_EVENTS.includes(event.type)) {
    const response = NextResponse.json({ received: true, handled: false }, { status: 200 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  }

  try {
    const result = await handleWebhookEvent(event);
    const response = NextResponse.json({ received: true, ...result }, { status: 200 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  } catch (error) {
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    const response = NextResponse.json({ received: true, error: 'Processing failed' }, { status: 500 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
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
