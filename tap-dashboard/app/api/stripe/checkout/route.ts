/**
 * Stripe Checkout Session API
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout session for MoltOS subscription tiers.
 * Supports three tiers: Builder ($29/month), Pro ($79/month), Enterprise ($199/month)
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// Lazy-load stripe client to avoid build-time errors
let stripe: Stripe;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not defined. Please set it in your environment variables.');
    }
    stripe = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripe;
}

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

// Rate limit: 10 checkouts per minute per IP
const MAX_BODY_SIZE_KB = 50;

// Validate URL to prevent open redirect
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS and same domain
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * POST handler for creating a checkout session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const path = '/api/stripe/checkout';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body: CheckoutRequest;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const { tier, userId, email, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!tier || !userId || !email) {
      const response = NextResponse.json(
        { error: 'Missing required fields: tier, userId, email', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate userId format (alphanumeric, max 64 chars)
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      const response = NextResponse.json(
        { error: 'Invalid userId format', code: 'INVALID_USERID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate tier
    if (!SUBSCRIPTION_TIERS[tier]) {
      const response = NextResponse.json(
        { 
          error: 'Invalid subscription tier', 
          code: 'INVALID_TIER',
          validTiers: Object.keys(SUBSCRIPTION_TIERS)
        },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      const response = NextResponse.json(
        { error: 'Invalid email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate URLs if provided (prevent open redirect)
    if (successUrl && !isValidUrl(successUrl)) {
      const response = NextResponse.json(
        { error: 'Invalid successUrl', code: 'INVALID_URL' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    if (cancelUrl && !isValidUrl(cancelUrl)) {
      const response = NextResponse.json(
        { error: 'Invalid cancelUrl', code: 'INVALID_URL' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];

    // Create or retrieve customer
    let customer: Stripe.Customer;
    const existingCustomers = await getStripe().customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      // Update metadata if needed
      if (customer.metadata?.userId !== userId) {
        customer = await getStripe().customers.update(customer.id, {
          metadata: { userId, tier },
        });
      }
    } else {
      customer = await getStripe().customers.create({
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

    const session = await getStripe().checkout.sessions.create(sessionConfig);

    console.log(`[Stripe Checkout] Created session for tier: ${tierConfig.name}`, {
      sessionId: session.id,
      userId,
      customerId: customer.id,
    });

    const response = NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      tier: tierConfig.name,
      amount: tierConfig.amount,
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('[Stripe Checkout] Error creating checkout session:', error);

    if (error instanceof Stripe.errors.StripeError) {
      const response = NextResponse.json(
        { 
          error: error.message, 
          code: error.code || 'STRIPE_ERROR',
          type: error.type
        },
        { status: error.statusCode || 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
        code: 'CHECKOUT_ERROR'
      },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

/**
 * GET handler for retrieving checkout session status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const path = '/api/stripe/checkout';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      const response = NextResponse.json(
        { error: 'sessionId is required', code: 'MISSING_SESSION_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate sessionId format (cs_test_ or cs_live_ prefix)
    if (!/^cs_(test|live)_[a-zA-Z0-9]{24,}$/.test(sessionId)) {
      const response = NextResponse.json(
        { error: 'Invalid sessionId format', code: 'INVALID_SESSION_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    const response = NextResponse.json({
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
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('[Stripe Checkout] Error retrieving session:', error);

    if (error instanceof Stripe.errors.StripeError) {
      const response = NextResponse.json(
        { 
          error: error.message, 
          code: error.code || 'STRIPE_ERROR'
        },
        { status: error.statusCode || 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json(
      { 
        error: 'Failed to retrieve checkout session',
        code: 'RETRIEVE_ERROR'
      },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
