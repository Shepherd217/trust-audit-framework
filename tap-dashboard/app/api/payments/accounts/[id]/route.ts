export const dynamic = 'force-dynamic';
/**
 * Connected Account Operations
 * 
 * GET /api/payments/accounts/[id] - Get account details
 * POST /api/payments/accounts/[id]/onboarding - Create onboarding link
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaymentError, stripe } from '@/lib/payments/stripe';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET - Retrieve connected account details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id || !id.startsWith('acct_')) {
      return NextResponse.json(
        { error: 'Invalid account ID format' },
        { status: 400 }
      );
    }

    const account = await stripe.accounts.retrieve(id);

    return NextResponse.json({
      accountId: account.id,
      type: account.type,
      email: account.email,
      country: account.country,
      businessType: account.business_type,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        pendingVerification: account.requirements?.pending_verification || [],
        disabledReason: account.requirements?.disabled_reason,
      },
      capabilities: account.capabilities,
      settings: {
        branding: account.settings?.branding,
        cardPayments: account.settings?.card_payments,
        payouts: account.settings?.payouts,
      },
      metadata: account.metadata,
      created: account.created,
    });
  } catch (error) {
    console.error('Retrieve account error:', error);

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    const stripeError = error as any;
    if (stripeError.code === 'account_invalid') {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
