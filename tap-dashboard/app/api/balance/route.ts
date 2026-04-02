export const dynamic = 'force-dynamic';
/**
 * Balance API
 * GET: Get current balance
 * POST: Add funds to balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserBalance, addToBalance } from '@/lib/payments/micropayments';
import { stripe } from '@/lib/payments/stripe';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
function sb() { return createTypedClient(SUPA_URL, SUPA_KEY); }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key');
  if (!key) return null;
  const hash = createHash('sha256').update(key).digest('hex');
  const { data } = await sb()
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .maybeSingle();
  return data || null;
}

const MAX_BODY_SIZE_KB = 50;

// ============================================================================
// GET: Get User Balance
// ============================================================================

export async function GET(request: NextRequest) {
  // Auth required — agents can only read their own balance
  const agent = await resolveAgent(request);
  if (!agent) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Authentication required. Provide X-API-Key header.', code: 'UNAUTHORIZED' },
      { status: 401 }
    ));
  }

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, '/api/balance');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const balance = await getUserBalance(agent.agent_id);

    return applySecurityHeaders(NextResponse.json({
      success: true,
      balance: {
        userId: balance.userId,
        balance: Math.round(balance.balance * 10000) / 10000,
        reserved: Math.round(balance.reserved * 10000) / 10000,
        available: Math.round((balance.balance - balance.reserved) * 10000) / 10000,
        currency: balance.currency,
        lifetimeSpent: Math.round(balance.lifetimeSpent * 10000) / 10000,
        lastUpdated: balance.lastUpdated.toISOString(),
      },
    }));

  } catch (error: any) {
    console.error('[Balance API] Error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: error.message || 'Failed to get balance', code: 'BALANCE_ERROR' },
      { status: 500 }
    ));
  }
}

// ============================================================================
// POST: Create Payment Intent to Add Funds
// ============================================================================

export async function POST(request: NextRequest) {
  // Apply rate limiting (financial endpoint)
  const rateLimitResult = await applyRateLimit(request, 'critical');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    // Validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      ));
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Invalid JSON', code: 'INVALID_JSON' },
        { status: 400 }
      ));
    }
    
    const { userId, amount, paymentMethodId } = body;
    
    if (!userId || typeof userId !== 'string') {
      return applySecurityHeaders(NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      ));
    }
    
    if (!amount || typeof amount !== 'number' || amount < 5) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'amount must be at least $5.00', code: 'INVALID_AMOUNT' },
        { status: 400 }
      ));
    }
    
    // Create Stripe payment intent with idempotency key
    const idempotencyKey = `balance_topup_${userId}_${Math.floor(Date.now() / 60000)}`; // 1-minute window
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      off_session: false,
      description: `MoltOS Balance Top-up - $${amount.toFixed(2)}`,
      metadata: {
        type: 'balance_topup',
        userId,
        requestedAmount: amount.toString(),
      },
    }, {
      idempotencyKey,
    });
    
    if (paymentIntent.status === 'succeeded') {
      // Add funds to balance
      const newBalance = await addToBalance(userId, amount, 'stripe', paymentIntent.id);
      
      return applySecurityHeaders(NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        amount,
        balance: {
          current: Math.round(newBalance.balance * 10000) / 10000,
          currency: newBalance.currency,
        },
      }));
    } else if (paymentIntent.status === 'requires_action') {
      return applySecurityHeaders(NextResponse.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }));
    } else {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Payment failed', status: paymentIntent.status, code: 'PAYMENT_FAILED' },
        { status: 400 }
      ));
    }
    
  } catch (error: any) {
    console.error('[Balance API] Error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: error.message || 'Failed to process payment', code: 'PAYMENT_ERROR' },
      { status: 500 }
    ));
  }
}
