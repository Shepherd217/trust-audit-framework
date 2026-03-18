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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['amount', 'currency', 'taskId', 'agentId', 'customerId'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: missingFields,
        },
        { status: 400 }
      );
    }

    // Validate amount is a positive integer
    if (!Number.isInteger(body.amount) || body.amount < 50) {
      return NextResponse.json(
        {
          error: 'Invalid amount',
          details: 'Amount must be at least $0.50 USD (50 cents) or equivalent',
        },
        { status: 400 }
      );
    }

    // Validate currency
    const validCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud', 'jpy'];
    if (!validCurrencies.includes(body.currency.toLowerCase())) {
      return NextResponse.json(
        {
          error: 'Invalid currency',
          details: `Supported currencies: ${validCurrencies.join(', ')}`,
        },
        { status: 400 }
      );
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
      platformFeePercent: body.platformFeePercent || 15,
      metadata: body.metadata,
    };

    // Create payment intent
    const result = await createPaymentIntent(createRequest);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Create payment intent error:', error);

    if (error instanceof PaymentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve payment intent details
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('paymentIntentId');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing paymentIntentId query parameter' },
        { status: 400 }
      );
    }

    const { retrievePaymentIntent } = await import('@/lib/payments/stripe');
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);

    return NextResponse.json(
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
  } catch (error) {
    console.error('Retrieve payment intent error:', error);

    if (error instanceof PaymentError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve payment intent' },
      { status: 500 }
    );
  }
}
