/**
 * Stripe Payment Service for MoltOS
 * 
 * Handles payment intents with escrow support, connected accounts for agents,
 * capture/cancel/refund operations, and webhook event processing.
 * 
 * @module lib/payments/stripe
 */

import Stripe from 'stripe';
import {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CapturePaymentRequest,
  CapturePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  ConnectedAccountRequest,
  ConnectedAccountResponse,
  TransferRequest,
  TransferResponse,
  PaymentIntentMetadata,
  WebhookEvent,
} from '@/types/payments';

// Lazy-initialized Stripe client
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable not configured');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export for backward compatibility
const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

// Constants
const DEFAULT_PLATFORM_FEE_PERCENT = 15;
const MINIMUM_PLATFORM_FEE_CENTS = 50; // $0.50 minimum

/**
 * Error class for payment-related errors
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public stripeError?: Stripe.errors.StripeError
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Create a payment intent with optional escrow support
 * 
 * @param params - Payment intent creation parameters
 * @returns Payment intent response with client secret
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentRequest
): Promise<CreatePaymentIntentResponse> {
  try {
    const {
      amount,
      currency,
      taskId,
      agentId,
      customerId,
      description,
      escrowEnabled = true,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
      metadata = {},
    } = params;

    // Validate amount (must be at least $0.50 USD or equivalent)
    if (amount < 50) {
      throw new PaymentError(
        'Amount must be at least $0.50 USD or equivalent',
        'INVALID_AMOUNT'
      );
    }

    // Calculate platform fee
    const platformFee = Math.max(
      Math.round(amount * (platformFeePercent / 100)),
      MINIMUM_PLATFORM_FEE_CENTS
    );

    // Build metadata
    const paymentMetadata: PaymentIntentMetadata = {
      taskId,
      agentId,
      customerId,
      escrowEnabled: escrowEnabled.toString(),
      platformFeePercent: platformFeePercent.toString(),
      description: description || '',
      ...metadata,
    };

    // Create payment intent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: currency.toLowerCase(),
      metadata: paymentMetadata as Record<string, string>,
      description: description || `Payment for task ${taskId}`,
      automatic_payment_methods: {
        enabled: true,
      },
      // If escrow is enabled, set capture_method to manual
      capture_method: escrowEnabled ? 'manual' : 'automatic',
    };

    // Add transfer data if agent has a connected account
    // This will be set later when agent is assigned
    // paymentIntentData.transfer_data = { destination: agentConnectedAccountId };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to create payment intent',
      stripeError.code ?? 'UNKNOWN_ERROR',
      stripeError
    );
  }
}

/**
 * Update payment intent with agent's connected account for transfer
 * 
 * @param paymentIntentId - The payment intent ID
 * @param agentConnectedAccountId - The agent's Stripe connected account ID
 * @param agentFeePercent - The percentage the agent receives (default: 85%)
 */
export async function updatePaymentIntentForAgent(
  paymentIntentId: string,
  agentConnectedAccountId: string,
  agentFeePercent: number = 85
): Promise<Stripe.PaymentIntent> {
  try {
    // Retrieve current payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    // Calculate agent's portion
    const agentAmount = Math.round(paymentIntent.amount * (agentFeePercent / 100));

    // Update payment intent with transfer data
    // Note: Transfer data is set at capture time for on_behalf_of transfers
    // We'll update metadata to store the agent info for later transfer
    const updatedPaymentIntent = await stripe.paymentIntents.update(
      paymentIntentId,
      {
        metadata: {
          ...paymentIntent.metadata,
          agentConnectedAccountId,
          agentAmount: agentAmount.toString(),
        },
      }
    );

    return updatedPaymentIntent;
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to update payment intent for agent',
      stripeError.code ?? 'UPDATE_ERROR',
      stripeError
    );
  }
}

/**
 * Capture authorized funds from a payment intent (escrow release)
 * 
 * @param params - Capture parameters
 * @returns Capture response
 */
export async function capturePayment(
  params: CapturePaymentRequest
): Promise<CapturePaymentResponse> {
  try {
    const { paymentIntentId, amount } = params;

    // Retrieve payment intent to verify it can be captured
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'requires_capture') {
      throw new PaymentError(
        `Payment intent cannot be captured. Current status: ${paymentIntent.status}`,
        'INVALID_STATUS'
      );
    }

    // Capture the payment
    const captureOptions: Stripe.PaymentIntentCaptureParams = {};
    if (amount) {
      // Partial capture
      if (amount > paymentIntent.amount_capturable || amount < 1) {
        throw new PaymentError(
          'Invalid capture amount',
          'INVALID_AMOUNT'
        );
      }
      captureOptions.amount_to_capture = amount;
    }

    const capturedPaymentIntent = await stripe.paymentIntents.capture(
      paymentIntentId,
      captureOptions
    );

    return {
      success: true,
      paymentIntentId: capturedPaymentIntent.id,
      status: capturedPaymentIntent.status,
      amountCaptured: capturedPaymentIntent.amount_received || 0,
    };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to capture payment',
      stripeError.code ?? 'CAPTURE_ERROR',
      stripeError
    );
  }
}

/**
 * Cancel a payment intent and release any authorized funds
 * 
 * @param paymentIntentId - The payment intent ID to cancel
 * @param cancellationReason - Reason for cancellation
 */
export async function cancelPayment(
  paymentIntentId: string,
  cancellationReason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'abandoned'
): Promise<{ success: boolean; status: string; canceledAt: number | null }> {
  try {
    const canceledPaymentIntent = await stripe.paymentIntents.cancel(
      paymentIntentId,
      cancellationReason ? { cancellation_reason: cancellationReason } : undefined
    );

    return {
      success: true,
      status: canceledPaymentIntent.status,
      canceledAt: canceledPaymentIntent.canceled_at,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to cancel payment',
      stripeError.code ?? 'CANCEL_ERROR',
      stripeError
    );
  }
}

/**
 * Refund a captured payment
 * 
 * @param params - Refund parameters
 * @returns Refund response
 */
export async function refundPayment(
  params: RefundPaymentRequest
): Promise<RefundPaymentResponse> {
  try {
    const { paymentIntentId, amount, reason } = params;

    // Get the charge ID by listing charges for this payment intent
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    
    if (!charges.data[0]) {
      throw new PaymentError(
        'No charge found for this payment intent',
        'NO_CHARGE_FOUND'
      );
    }

    const chargeId = charges.data[0].id;

    // Create refund
    const refundData: Stripe.RefundCreateParams = {
      charge: chargeId,
      reason: (reason || 'requested_by_customer') as Stripe.RefundCreateParams['reason'],
    };

    if (amount) {
      refundData.amount = amount;
    }

    const refund = await stripe.refunds.create(refundData);

    return {
      success: true,
      refundId: refund.id,
      amountRefunded: refund.amount,
      status: refund.status ?? 'pending',
    };
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to process refund',
      stripeError.code ?? 'REFUND_ERROR',
      stripeError
    );
  }
}

/**
 * Create a connected account for an agent (Express or Custom)
 * 
 * @param params - Connected account creation parameters
 * @returns Connected account response
 */
export async function createConnectedAccount(
  params: ConnectedAccountRequest
): Promise<ConnectedAccountResponse> {
  try {
    const { email, country, businessType = 'individual', metadata = {} } = params;

    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      business_type: businessType,
      metadata,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return {
      accountId: account.id,
      status: 'created',
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        pendingVerification: account.requirements?.pending_verification || [],
      },
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to create connected account',
      stripeError.code ?? 'ACCOUNT_CREATE_ERROR',
      stripeError
    );
  }
}

/**
 * Create an onboarding link for a connected account
 * 
 * @param accountId - The connected account ID
 * @param refreshUrl - URL to redirect if onboarding fails
 * @param returnUrl - URL to redirect after successful onboarding
 * @returns Onboarding URL
 */
export async function createAccountOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<{ url: string }> {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to create onboarding link',
      stripeError.code ?? 'ONBOARDING_ERROR',
      stripeError
    );
  }
}

/**
 * Create a direct transfer to a connected account
 * 
 * @param params - Transfer parameters
 * @returns Transfer response
 */
export async function createTransfer(
  params: TransferRequest
): Promise<TransferResponse> {
  try {
    const { amount, currency, destinationAccountId, paymentIntentId, description } = params;

    const transfer = await stripe.transfers.create({
      amount,
      currency: (currency || 'usd').toLowerCase(),
      destination: destinationAccountId,
      transfer_group: paymentIntentId || undefined,
      description: description || `Transfer for payment ${paymentIntentId || 'unknown'}`,
      metadata: {
        paymentIntentId: paymentIntentId || '',
      },
    });

    return {
      transferId: transfer.id,
      amount: transfer.amount,
      destination: typeof transfer.destination === 'string' ? transfer.destination : undefined,
      status: 'paid', // Transfers are immediate in most cases
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to create transfer',
      stripeError.code ?? 'TRANSFER_ERROR',
      stripeError
    );
  }
}

/**
 * Retrieve payment intent details
 * 
 * @param paymentIntentId - The payment intent ID
 * @returns Payment intent object
 */
export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    throw new PaymentError(
      stripeError.message || 'Failed to retrieve payment intent',
      stripeError.code ?? 'RETRIEVE_ERROR',
      stripeError
    );
  }
}

/**
 * Verify and construct webhook event from raw payload
 * 
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 * @returns Verified webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): WebhookEvent {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    ) as unknown as WebhookEvent;

    return event;
  } catch (error) {
    const err = error as Error;
    throw new PaymentError(
      `Webhook signature verification failed: ${err.message}`,
      'WEBHOOK_VERIFICATION_FAILED'
    );
  }
}

/**
 * Handle webhook events
 * 
 * @param event - The webhook event
 * @returns Handler result
 */
export async function handleWebhookEvent(
  event: WebhookEvent
): Promise<{ handled: boolean; action?: string; data?: any }> {
  const { type, data } = event;

  switch (type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(data.object as unknown as Stripe.PaymentIntent);

    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(data.object as unknown as Stripe.PaymentIntent);

    case 'payment_intent.canceled':
      return handlePaymentIntentCanceled(data.object as unknown as Stripe.PaymentIntent);

    case 'payment_intent.amount_capturable_updated':
      return handlePaymentIntentCapturable(data.object as unknown as Stripe.PaymentIntent);

    case 'charge.refunded':
      return handleChargeRefunded(data.object as unknown as Stripe.Charge);

    case 'charge.dispute.created':
      return handleDisputeCreated(data.object as unknown as Stripe.Dispute);

    case 'account.updated':
      return handleAccountUpdated(data.object as unknown as Stripe.Account);

    case 'transfer.failed':
      return handleTransferFailed(data.object as unknown as Stripe.Transfer);

    default:
      return { handled: false };
  }
}

// Webhook event handlers
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ handled: boolean; action: string; data: any }> {
  // If this was an automatic capture (non-escrow), process agent payout
  if (paymentIntent.capture_method === 'automatic') {
    // Process automatic payout
    return {
      handled: true,
      action: 'PAYMENT_SUCCEEDED_AUTOMATIC',
      data: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        transferData: paymentIntent.transfer_data,
      },
    };
  }

  return {
    handled: true,
    action: 'PAYMENT_REQUIRES_CAPTURE',
    data: {
      paymentIntentId: paymentIntent.id,
      amountCapturable: paymentIntent.amount_capturable,
    },
  };
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'PAYMENT_FAILED',
    data: {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
    },
  };
}

async function handlePaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'PAYMENT_CANCELED',
    data: {
      paymentIntentId: paymentIntent.id,
      cancellationReason: paymentIntent.cancellation_reason,
    },
  };
}

async function handlePaymentIntentCapturable(
  paymentIntent: Stripe.PaymentIntent
): Promise<{ handled: boolean; action: string; data: any }> {
  // Funds are authorized and ready to be captured
  return {
    handled: true,
    action: 'PAYMENT_CAPTURE_READY',
    data: {
      paymentIntentId: paymentIntent.id,
      amountCapturable: paymentIntent.amount_capturable,
      escrowEnabled: paymentIntent.metadata?.escrowEnabled === 'true',
    },
  };
}

async function handleChargeRefunded(
  charge: Stripe.Charge
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'CHARGE_REFUNDED',
    data: {
      chargeId: charge.id,
      paymentIntentId: charge.payment_intent,
      amountRefunded: charge.amount_refunded,
      refunds: charge.refunds,
    },
  };
}

async function handleDisputeCreated(
  dispute: Stripe.Dispute
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'DISPUTE_CREATED',
    data: {
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
    },
  };
}

async function handleAccountUpdated(
  account: Stripe.Account
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'ACCOUNT_UPDATED',
    data: {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements,
    },
  };
}

async function handleTransferFailed(
  transfer: Stripe.Transfer
): Promise<{ handled: boolean; action: string; data: any }> {
  return {
    handled: true,
    action: 'TRANSFER_FAILED',
    data: {
      transferId: transfer.id,
      destination: transfer.destination,
      amount: transfer.amount,
      // Note: failure_code not available in current Stripe SDK version
      failureCode: (transfer as any).failure_code,
    },
  };
}

// Export stripe client for advanced usage
export { stripe };
