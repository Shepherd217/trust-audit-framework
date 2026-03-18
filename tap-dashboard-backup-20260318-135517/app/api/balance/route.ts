/**
 * Balance API
 * GET: Get current balance
 * POST: Add funds to balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserBalance, addToBalance } from '@/lib/payments/micropayments';
import { stripe } from '@/lib/payments/stripe';

// ============================================================================
// GET: Get User Balance
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    const balance = await getUserBalance(userId);
    
    return NextResponse.json({
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
    });
    
  } catch (error: any) {
    console.error('[Balance API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balance', code: 'BALANCE_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Create Payment Intent to Add Funds
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, paymentMethodId } = body;
    
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    if (!amount || typeof amount !== 'number' || amount < 5) {
      return NextResponse.json(
        { error: 'amount must be at least $5.00', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }
    
    // Create Stripe payment intent
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
    });
    
    if (paymentIntent.status === 'succeeded') {
      // Add funds to balance
      const newBalance = await addToBalance(userId, amount, 'stripe', paymentIntent.id);
      
      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        amount,
        balance: {
          current: Math.round(newBalance.balance * 10000) / 10000,
          currency: newBalance.currency,
        },
      });
    } else if (paymentIntent.status === 'requires_action') {
      return NextResponse.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } else {
      return NextResponse.json(
        { error: 'Payment failed', status: paymentIntent.status, code: 'PAYMENT_FAILED' },
        { status: 400 }
      );
    }
    
  } catch (error: any) {
    console.error('[Balance API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process payment', code: 'PAYMENT_ERROR' },
      { status: 500 }
    );
  }
}