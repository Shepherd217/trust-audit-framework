/**
 * Stripe Client Configuration for MoltOS
 * 
 * Centralized Stripe configuration and client export.
 * Supports both payment processing and subscription management.
 * 
 * @module lib/stripe
 */

import Stripe from 'stripe';

// ============================================================================
// Client Initialization
// ============================================================================

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined. Please set it in your environment variables.'
      );
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
      appInfo: {
        name: 'MoltOS',
        version: '1.0.0',
      },
    });
  }
  return stripeClient;
}

/**
 * Main Stripe client instance
 * Use this for all Stripe API calls
 */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    const client = getStripeClient();
    return (client as any)[prop];
  },
});

// ============================================================================
// Subscription Configuration
// ============================================================================

/**
 * MoltOS Subscription Tiers
 * 
 * These price IDs should be created in your Stripe Dashboard
 * and the IDs stored in environment variables.
 */
export const STRIPE_PRICES = {
  builder: {
    id: process.env.STRIPE_PRICE_BUILDER || 'price_builder_placeholder',
    name: 'Builder',
    description: 'For individuals and small projects',
    amount: 2900, // $29.00 in cents
    interval: 'month' as const,
    features: [
      '10 agents',
      '1,000 tasks/month',
      'Basic analytics',
      'Email support',
      'API access',
    ],
  },
  pro: {
    id: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
    name: 'Pro',
    description: 'For growing teams and businesses',
    amount: 7900, // $79.00 in cents
    interval: 'month' as const,
    features: [
      '50 agents',
      '10,000 tasks/month',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom integrations',
      'Team collaboration',
    ],
  },
  enterprise: {
    id: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_placeholder',
    name: 'Enterprise',
    description: 'For large organizations',
    amount: 19900, // $199.00 in cents
    interval: 'month' as const,
    features: [
      'Unlimited agents',
      'Unlimited tasks',
      'Enterprise analytics',
      'Dedicated support',
      'API access',
      'Custom integrations',
      'Team collaboration',
      'SSO & SAML',
      'Audit logs',
      'SLA guarantee',
    ],
  },
} as const;

export type SubscriptionTier = keyof typeof STRIPE_PRICES;

// ============================================================================
// Customer Portal
// ============================================================================

/**
 * Create a Stripe Customer Portal session
 * 
 * Allows customers to manage their subscriptions, update payment methods,
 * view invoices, and cancel subscriptions.
 * 
 * @param customerId - Stripe Customer ID
 * @param returnUrl - URL to return to after portal session
 * @returns Portal session URL
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl?: string
): Promise<{ url: string }> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
    });

    return { url: session.url };
  } catch (error) {
    console.error('[Stripe] Error creating customer portal session:', error);
    throw error;
  }
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Retrieve a subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method', 'latest_invoice'],
  });
}

/**
 * Cancel a subscription
 * 
 * @param subscriptionId - Stripe Subscription ID
 * @param immediate - If true, cancels immediately; otherwise cancels at period end
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediate: boolean = false
): Promise<Stripe.Subscription> {
  if (immediate) {
    return stripe.subscriptions.cancel(subscriptionId);
  } else {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Resume a subscription that was set to cancel at period end
 */
export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Update subscription tier
 * 
 * @param subscriptionId - Stripe Subscription ID
 * @param newPriceId - New Stripe Price ID
 */
export async function updateSubscriptionTier(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Get the current subscription item
  const currentItem = subscription.items.data[0];

  if (!currentItem) {
    throw new Error('No subscription items found');
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: currentItem.id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}

// ============================================================================
// Customer Management
// ============================================================================

/**
 * Get or create a customer by email
 */
export async function getOrCreateCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  // Search for existing customer
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    const customer = customers.data[0];
    
    // Update metadata if provided
    if (metadata) {
      return stripe.customers.update(customer.id, { metadata });
    }
    
    return customer;
  }

  // Create new customer
  return stripe.customers.create({
    email,
    metadata,
  });
}

/**
 * Get customer's active subscriptions
 */
export async function getCustomerSubscriptions(
  customerId: string
): Promise<Stripe.ApiList<Stripe.Subscription>> {
  return stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    expand: ['data.default_payment_method'],
  });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Stripe-related errors
 */
export class StripeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public stripeError?: Stripe.errors.StripeError
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

/**
 * Helper to handle Stripe errors consistently
 */
export function handleStripeError(error: unknown): StripeError {
  if (error instanceof Stripe.errors.StripeError) {
    return new StripeError(
      error.message,
      error.code,
      error
    );
  }

  if (error instanceof Error) {
    return new StripeError(error.message);
  }

  return new StripeError('An unknown error occurred');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format amount for display (cents to dollars)
 */
export function formatAmount(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Get subscription tier from price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  for (const [tier, config] of Object.entries(STRIPE_PRICES)) {
    if (config.id === priceId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: Stripe.Subscription): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if subscription is in grace period (past_due but not yet unpaid)
 */
export function isInGracePeriod(subscription: Stripe.Subscription): boolean {
  return subscription.status === 'past_due';
}
