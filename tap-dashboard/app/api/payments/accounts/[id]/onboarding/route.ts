/**
 * Create onboarding link for connected account
 * 
 * POST /api/payments/accounts/[id]/onboarding
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAccountOnboardingLink, PaymentError } from '@/lib/payments/stripe';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
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

    const body = await request.json();

    // Validate URLs
    if (!body.refreshUrl || !body.returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: refreshUrl, returnUrl' },
        { status: 400 }
      );
    }

    try {
      new URL(body.refreshUrl);
      new URL(body.returnUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format for refreshUrl or returnUrl' },
        { status: 400 }
      );
    }

    const link = await createAccountOnboardingLink(
      id,
      body.refreshUrl,
      body.returnUrl
    );

    return NextResponse.json({
      success: true,
      data: link,
      message: 'Onboarding link created successfully',
    });
  } catch (error) {
    console.error('Create onboarding link error:', error);

    if (error instanceof PaymentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
