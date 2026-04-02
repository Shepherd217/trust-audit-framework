export const dynamic = 'force-dynamic';
/**
 * POST /api/payments/create-intent
 *
 * Creates a payment intent for a task with optional escrow support.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPaymentIntent,
  PaymentError,
} from '@/lib/payments/stripe';
import { CreatePaymentIntentRequest } from '@/types/payments';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// Rate limit: 20 payment intents per minute per IP
const MAX_BODY_SIZE_KB = 100;
const MAX_AMOUNT = 10000000; // $100,000 maximum (in cents)
const MAX_METADATA_KEYS = 50;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting - financial endpoint
  const _rl = await applyRateLimit(request, '/api/payments/create-intent');
  if (_rl.response) return _rl.response;

  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }

    // Parse request body
    const body = JSON.parse(bodyText);

    // Validate required fields
    const requiredFields = ['amount', 'currency', 'taskId', 'agentId', 'customerId'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      const response = NextResponse.json(
        {
          error: 'Missing required fields',
          details: missingFields,
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate amount is a positive integer
    if (!Number.isInteger(body.amount) || body.amount < 50) {
      const response = NextResponse.json(
        {
          error: 'Invalid amount',
          details: 'Amount must be at least $0.50 USD (50 cents) or equivalent',
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate maximum amount (prevent overflow/float issues)
    if (body.amount > MAX_AMOUNT) {
      const response = NextResponse.json(
        {
          error: 'Invalid amount',
          details: `Amount cannot exceed $${MAX_AMOUNT / 100}`,
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate currency
    const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'];
    if (!validCurrencies.includes(body.currency.toLowerCase())) {
      const response = NextResponse.json(
        {
          error: 'Invalid currency',
          details: `Supported currencies: ${validCurrencies.join(', ')}`,
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate metadata size if provided
    if (body.metadata && typeof body.metadata === 'object') {
      const metadataKeys = Object.keys(body.metadata);
      if (metadataKeys.length > MAX_METADATA_KEYS) {
        const response = NextResponse.json(
          {
            error: 'Invalid metadata',
            details: `Metadata cannot have more than ${MAX_METADATA_KEYS} keys`,
          },
          { status: 400 }
        );
        return applySecurityHeaders(response);
      }
    }

    // Build create request
    const createRequest: CreatePaymentIntentRequest = {
      amount: body.amount,
      currency: body.currency,
      taskId: body.taskId,
      agentId: body.agentId,
      customerId: body.customerId,
      description: body.description,
      escrowEnabled: body.escrowEnabled !== false, // Default to true
      platformFeePercent: body.platformFeePercent || 2.5,
      metadata: body.metadata,
    };

    // Create payment intent
    const result = await createPaymentIntent(createRequest);

    const response = NextResponse.json(result, { status: 200 });
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('Create payment intent error:', error);

    if (error instanceof PaymentError) {
      const response = NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}

// Optional: GET endpoint to retrieve payment intent details
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply rate limiting
  const _rl = await applyRateLimit(request, '/api/payments/create-intent');
  if (_rl.response) return _rl.response;

  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('paymentIntentId');

    if (!paymentIntentId) {
      const response = NextResponse.json(
        { error: 'Missing paymentIntentId query parameter' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate paymentIntentId format (basic)
    if (typeof paymentIntentId !== 'string' || paymentIntentId.length > 100) {
      const response = NextResponse.json(
        { error: 'Invalid paymentIntentId format' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    const { retrievePaymentIntent } = await import('@/lib/payments/stripe');
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);

    const response = NextResponse.json(
      {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
        created: paymentIntent.created,
        charges: (paymentIntent as any).charges?.data?.map((charge: any) => ({
          id: charge.id,
          status: charge.status,
          amount: charge.amount,
          receiptUrl: charge.receipt_url,
        })) || [],
      },
      { status: 200 }
    );
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('Retrieve payment intent error:', error);

    if (error instanceof PaymentError) {
      const response = NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json(
      { error: 'Failed to retrieve payment intent' },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}
