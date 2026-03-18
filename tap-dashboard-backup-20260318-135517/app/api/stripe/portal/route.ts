/**
 * Stripe Customer Portal API
 * POST /api/stripe/portal
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions,
 * payment methods, and viewing invoices.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

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

/**
 * Get or create a customer by email
 */
async function getOrCreateCustomer(
  email: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = getStripe();
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
 * Create a Stripe Customer Portal session
 */
async function createCustomerPortalSession(
  customerId: string,
  returnUrl?: string
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings`,
  });

  return { url: session.url };
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
  try {
    const body: PortalRequest = await request.json();
    const { userId, email, returnUrl } = body;

    // Validate required fields
    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email', code: 'MISSING_FIELDS' },
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

    // Get or create customer
    const customer = await getOrCreateCustomer(email, {
      userId,
      source: 'moltos_portal',
    });

    // Create portal session
    const portalSession = await createCustomerPortalSession(
      customer.id,
      returnUrl
    );

    console.log('[Stripe Portal] Created portal session:', {
      customerId: customer.id,
      userId,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
      customerId: customer.id,
    });

  } catch (error) {
    console.error('[Stripe Portal] Error creating portal session:', error);

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
        error: error instanceof Error ? error.message : 'Failed to create portal session',
        code: 'PORTAL_ERROR'
      },
      { status: 500 }
    );
  }
}
