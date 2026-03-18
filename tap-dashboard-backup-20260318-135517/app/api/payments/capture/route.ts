/**
 * POST /api/payments/capture
 * 
 * Captures authorized funds from a payment intent (releases escrow).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  capturePayment,
  PaymentError,
} from '@/lib/payments/stripe';
import { CapturePaymentRequest } from '@/types/payments';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing required field: paymentIntentId' },
        { status: 400 }
      );
    }

    // Validate optional amount for partial capture
    if (body.amount !== undefined) {
      if (!Number.isInteger(body.amount) || body.amount < 1) {
        return NextResponse.json(
          { error: 'Invalid amount. Must be a positive integer in cents.' },
          { status: 400 }
        );
      }
    }

    // Build capture request
    const captureRequest: CapturePaymentRequest = {
      paymentIntentId: body.paymentIntentId,
      amount: body.amount,
    };

    // Capture payment
    const result = await capturePayment(captureRequest);

    // TODO: Notify task service of successful capture
    // This could trigger:
    // - Task status update to 'completed'
    // - Agent notification of payment release
    // - Customer receipt email

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Payment captured successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Capture payment error:', error);

    if (error instanceof PaymentError) {
      // Map specific error codes to appropriate HTTP status
      let statusCode = 400;
      
      switch (error.code) {
        case 'INVALID_STATUS':
          statusCode = 409; // Conflict
          break;
        case 'INVALID_AMOUNT':
          statusCode = 422; // Unprocessable Entity
          break;
        case 'resource_missing':
          statusCode = 404;
          break;
        default:
          statusCode = 400;
      }

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusCode }
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
