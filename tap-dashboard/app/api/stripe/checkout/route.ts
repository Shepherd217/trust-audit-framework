/**
 * Stripe Checkout Session API
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout session for MoltOS subscription tiers.
 * Supports three tiers: Builder ($29/month), Pro ($79/month), Enterprise ($199/month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Subscription tier configuration
const SUBSCRIPTION_TIERS = {
  builder: {
    name: 'Builder',
    priceId: process.env.STRIPE_PRICE_BUILDER || 'price_builder_placeholder',
    amount: 2900, // $29.00 in cents
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO || 'price_pro_placeholder',
    amount: 7900, // $79.00 in cents
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_placeholder',
    amount: 19900, // $199.00 in cents
  },
} as const;

type TierKey = keyof typeof SUBSCRIPTION_TIERS;

interface CheckoutRequest {
  tier: TierKey;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * POST handler for creating a checkout session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: CheckoutRequest = await request.json();
    const { tier, userId, email, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!tier || !userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, userId, email', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Validate tier
    if (!SUBSCRIPTION_TIERS[tier]) {
      return NextResponse.json(
        { 
          error: 'Invalid subscription tier', 
          code: 'INVALID_TIER',
          validTiers: Object.keys(SUBSCRIPTION_TIERS)
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];

    // Create or retrieve customer
    let customer: Stripe.Customer;
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update metadata if needed
      if (customer.metadata?.userId !== userId) {
        customer = await stripe.customers.update(customer.id, {
          metadata: { userId, tier },
        });
      }
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
          tier,
          source: 'moltos_checkout',
        },
      });
    }

    // Create checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      mode: 'subscription',
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
      metadata: {
        userId,
        tier,
        customerEmail: email,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
      // Enable tax collection if configured
      automatic_tax: {
        enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true',
      },
      // Collect billing address for tax purposes
      billing_address_collection: 'auto',
      // Allow promotion codes
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log(`[Stripe Checkout] Created session for tier: ${tierConfig.name}`, {
      sessionId: session.id,
      userId,
      customerId: customer.id,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      tier: tierConfig.name,
      amount: tierConfig.amount,
    });

  } catch (error) {
    console.error('[Stripe Checkout] Error creating checkout session:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code || 'STRIPE_ERROR',
          type: error.type
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
        code: 'CHECKOUT_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for retrieving checkout session status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required', code: 'MISSING_SESSION_ID' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription,
        customerId: session.customer,
        tier: session.metadata?.tier,
        url: session.url,
      },
    });

  } catch (error) {
    console.error('[Stripe Checkout] Error retrieving session:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code || 'STRIPE_ERROR'
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to retrieve checkout session',
        code: 'RETRIEVE_ERROR'
      },
      { status: 500 }
    );
  }
}
