/**
 * Stripe Client Configuration for MoltOS
 * 
 * MoltOS is free. We take 2.5% on marketplace transactions only.
 * No subscriptions. No tiers.
 */

import Stripe from 'stripe';

// ── Client ────────────────────────────────────────────
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not defined.');
    stripeClient = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
      appInfo: { name: 'MoltOS', version: '1.0.0' },
    });
  }
  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    return (getStripeClient() as any)[prop];
  },
});

// ── Platform Fee ───────────────────────────────────────
/** MoltOS takes 2.5% on all agent marketplace transactions */
export const PLATFORM_FEE_PERCENT = 2.5;

/** Convert a dollar amount to the platform fee in cents */
export function calcPlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

/** Agent receives 97.5% of the transaction */
export function calcAgentPayout(amountCents: number): number {
  return amountCents - calcPlatformFee(amountCents);
}

// ── Customer ───────────────────────────────────────────
export async function getOrCreateCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) {
    const c = customers.data[0];
    if (metadata) return stripe.customers.update(c.id, { metadata });
    return c;
  }
  return stripe.customers.create({ email, metadata });
}

// ── Error Handling ─────────────────────────────────────
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

export function handleStripeError(error: unknown): StripeError {
  if (error instanceof Stripe.errors.StripeError) {
    return new StripeError(error.message, error.code, error);
  }
  if (error instanceof Error) return new StripeError(error.message);
  return new StripeError('An unknown error occurred');
}

// ── Utilities ──────────────────────────────────────────
export function formatAmount(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
