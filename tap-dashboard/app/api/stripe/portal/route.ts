export const dynamic = 'force-dynamic';
/**
 * Stripe Customer Portal API
 * POST /api/stripe/portal
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions,
 * payment methods, and viewing invoices.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// Lazy-load stripe client to avoid build-time errors
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not defined. Please set it in your environment variables.');
    }
    stripeClient = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripeClient;
}

// Rate limit: 10 portal sessions per minute per IP
const MAX_BODY_SIZE_KB = 50;

// Validate URL to prevent open redirect
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get or create a customer by email
 */
async function getOrCreateCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    const customer = customers.data[0];
    if (metadata) {
      return stripe.customers.update(customer.id, { metadata });
    }
    return customer;
  }

  return stripe.customers.create({ email, metadata });
}

interface PortalRequest {
  userId: string;
  email: string;
  returnUrl?: string;
}

/**
 * POST handler for creating a customer portal session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const path = '/api/stripe/portal';
  
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }
    
    let body: PortalRequest;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    const { userId, email, returnUrl } = body;

    if (!userId || !email) {
      const response = NextResponse.json(
        { error: 'Missing required fields: userId, email', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate userId format
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      const response = NextResponse.json(
        { error: 'Invalid userId format', code: 'INVALID_USERID' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      const response = NextResponse.json(
        { error: 'Invalid email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate returnUrl if provided
    if (returnUrl && !isValidUrl(returnUrl)) {
      const response = NextResponse.json(
        { error: 'Invalid returnUrl', code: 'INVALID_URL' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    const customer = await getOrCreateCustomer(email, { userId, source: 'moltos_portal' });

    const session = await getStripe().billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'}/dashboard/settings`,
    });

    console.error('[Stripe Portal] Created portal session:', { customerId: customer.id, userId });

    const response = NextResponse.json({
      success: true,
      url: session.url,
      customerId: customer.id,
    });
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('[Stripe Portal] Error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      const response = NextResponse.json(
        { error: error.message, code: error.code || 'STRIPE_ERROR', type: error.type },
        { status: error.statusCode || 500 }
      );
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create portal session', code: 'PORTAL_ERROR' },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}
