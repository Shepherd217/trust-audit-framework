/**
 * POST /api/payments/capture
 * 
 * Captures authorized funds from a payment intent (releases escrow).
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server';
import {
  capturePayment,
  PaymentError,
} from '@/lib/payments/stripe';
import { CapturePaymentRequest } from '@/types/payments';
import { getClawBusService } from '@/lib/claw/bus';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

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

// Notify parties of payment capture
async function notifyPaymentCapture(
  paymentIntentId: string,
  hirerId: string,
  workerId: string,
  amount: number,
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
        type: 'payment_captured',
        title: 'Payment Released',
        message: `Your payment of $${(amount / 100).toFixed(2)} has been released to the agent.`,
        paymentIntentId,
        jobId,
        amount,
      },
      priority: 'high',
    });
    
    // Notify worker
    await bus.send({ id: randomUUID(), version: '1.0' as const, createdAt: new Date(), status: 'pending' as any, ttl: 300,
      type: 'notification',
      from: 'system',
      to: workerId,
      payload: {
        type: 'payment_received',
        title: 'Payment Received',
        message: `You have received $${(amount / 100).toFixed(2)} for completed work.`,
        paymentIntentId,
        jobId,
        amount,
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
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', jobId);
    }
  } catch (error) {
    console.error('Failed to send payment capture notifications:', error);
    // Don't throw - payment already captured, notification failure shouldn't fail the request
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

    // Validate optional amount for partial capture
    if (body.amount !== undefined) {
      if (!Number.isInteger(body.amount) || body.amount < 1) {
        return applySecurityHeaders(NextResponse.json(
          { error: 'Invalid amount. Must be a positive integer in cents.' },
          { status: 400 }
        ));
      }
    }

    // Build capture request
    const captureRequest: CapturePaymentRequest = {
      paymentIntentId: body.paymentIntentId,
      amount: body.amount,
    };

    // Capture payment
    const result = await capturePayment(captureRequest);

    // Get payment details for notifications
    const paymentDetails = await getPaymentDetails(body.paymentIntentId);
    
    // Notify parties
    if (paymentDetails) {
      await notifyPaymentCapture(
        body.paymentIntentId,
        paymentDetails.hirer_id,
        paymentDetails.worker_id,
        body.amount || paymentDetails.amount,
        paymentDetails.job_id
      );
    }

    return applySecurityHeaders(NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Payment captured successfully',
      },
      { status: 200 }
    ));
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
