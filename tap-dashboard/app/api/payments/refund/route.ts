/**
 * POST /api/payments/refund
 *
 * Handles refunds for captured payments.
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server';
import {
  refundPayment,
  PaymentError,
} from '@/lib/payments/stripe';
import { RefundPaymentRequest } from '@/types/payments';
import { getClawBusService } from '@/lib/claw/bus';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Valid refund reasons
const VALID_REFUND_REASONS: Array<'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge'> = [
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'expired_uncaptured_charge',
];

// Helper to get payment details
async function getPaymentDetails(paymentIntentId: string) {
  const supabase = createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data, error } = await supabase
    .from('payment_escrows')
    .select('hirer_id, worker_id, amount_total, job_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (error || !data) {
    return null;
  }

  // Normalize field names for downstream compatibility
  return {
    hirer_id: data.hirer_id,
    worker_id: data.worker_id,
    amount: data.amount_total,
    job_id: data.job_id
  };
}

// Notify parties of refund
async function notifyRefund(
  paymentIntentId: string,
  hirerId: string,
  workerId: string,
  amount: number,
  reason?: string,
  jobId?: string
): Promise<void> {
  try {
    const bus = getClawBusService();

    // Notify hirer
    await bus.send({ id: randomUUID(), version: '1.0' as const, createdAt: new Date(), status: 'pending' as any, ttl: 300,
      type: 'notification',
      from: 'system',
      to: hirerId,
      payload: {
        type: 'payment_refunded',
        title: 'Payment Refunded',
        message: `Your payment of $${(amount / 100).toFixed(2)} has been refunded${reason ? ` (${reason})` : ''}.`,
        paymentIntentId,
        jobId,
        amount,
        reason,
      },
      priority: 'high',
    });

    // Notify worker
    await bus.send({ id: randomUUID(), version: '1.0' as const, createdAt: new Date(), status: 'pending' as any, ttl: 300,
      type: 'notification',
      from: 'system',
      to: workerId,
      payload: {
        type: 'work_refunded',
        title: 'Work Refunded',
        message: `The payment for your work has been refunded to the customer${reason ? ` (${reason})` : ''}.`,
        paymentIntentId,
        jobId,
        amount,
        reason,
      },
      priority: 'high',
    });

    // Update job status if jobId exists
    if (jobId) {
      const supabase = createTypedClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );

      await supabase
        .from('marketplace_jobs')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', jobId);
    }
  } catch (error) {
    console.error('Failed to send refund notifications:', error);
    // Don't throw - refund already processed, notification failure shouldn't fail the request
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, 'critical');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.paymentIntentId) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing required field: paymentIntentId' },
        { status: 400 }
      ));
    }

    // Validate optional amount for partial refund
    if (body.amount !== undefined) {
      if (!Number.isInteger(body.amount) || body.amount < 1) {
        return applySecurityHeaders(NextResponse.json(
          { error: 'Invalid amount. Must be a positive integer in cents.' },
          { status: 400 }
        ));
      }
    }

    // Validate reason if provided
    if (body.reason && !VALID_REFUND_REASONS.includes(body.reason)) {
      return applySecurityHeaders(NextResponse.json(
        {
          error: 'Invalid refund reason',
          validReasons: VALID_REFUND_REASONS,
        },
        { status: 400 }
      ));
    }

    // Build refund request
    const refundRequest: RefundPaymentRequest = {
      paymentIntentId: body.paymentIntentId,
      amount: body.amount,
      reason: body.reason,
    };

    // Process refund
    const result = await refundPayment(refundRequest);

    // Get payment details for notifications
    const paymentDetails = await getPaymentDetails(body.paymentIntentId);

    // Notify parties
    if (paymentDetails) {
      await notifyRefund(
        body.paymentIntentId,
        paymentDetails.hirer_id,
        paymentDetails.worker_id,
        body.amount || paymentDetails.amount,
        body.reason,
        paymentDetails.job_id
      );
    }

    return applySecurityHeaders(NextResponse.json(
      {
        success: true,
        data: result,
        message: body.amount
          ? `Partial refund of $${(body.amount / 100).toFixed(2)} processed successfully`
          : 'Full refund processed successfully',
      },
      { status: 200 }
    ));
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

      return applySecurityHeaders(NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusCode }
      ));
    }

    return applySecurityHeaders(NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    ));
  }
}
