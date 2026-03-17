/**
 * POST /api/payments/refund
 * 
 * Handles refunds for captured payments.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  refundPayment,
  PaymentError,
} from '@/lib/payments/stripe';
import { RefundPaymentRequest } from '@/types/payments';

// Valid refund reasons
const VALID_REFUND_REASONS: Array<'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge'> = [
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'expired_uncaptured_charge',
];

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

    // Validate optional amount for partial refund
    if (body.amount !== undefined) {
      if (!Number.isInteger(body.amount) || body.amount < 1) {
        return NextResponse.json(
          { error: 'Invalid amount. Must be a positive integer in cents.' },
          { status: 400 }
        );
      }
    }

    // Validate reason if provided
    if (body.reason && !VALID_REFUND_REASONS.includes(body.reason)) {
      return NextResponse.json(
        {
          error: 'Invalid refund reason',
          validReasons: VALID_REFUND_REASONS,
        },
        { status: 400 }
      );
    }

    // Build refund request
    const refundRequest: RefundPaymentRequest = {
      paymentIntentId: body.paymentIntentId,
      amount: body.amount,
      reason: body.reason,
    };

    // Process refund
    const result = await refundPayment(refundRequest);

    // TODO: Notify task service of refund
    // This could trigger:
    // - Task status update to 'refunded' or 'disputed'
    // - Agent notification of refund
    // - Customer confirmation email

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: body.amount
          ? `Partial refund of $${(body.amount / 100).toFixed(2)} processed successfully`
          : 'Full refund processed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Refund payment error:', error);

    if (error instanceof PaymentError) {
      let statusCode = 400;
      
      switch (error.code) {
        case 'NO_CHARGE_FOUND':
          statusCode = 404;
          break;
        case 'charge_already_refunded':
          statusCode = 409; // Conflict
          break;
        case 'amount_too_large':
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
