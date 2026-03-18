/**
 * API Routes for Connected Account Management
 * 
 * POST /api/payments/accounts - Create a new connected account
 * GET /api/payments/accounts/:id - Get account details
 * POST /api/payments/accounts/:id/onboarding - Create onboarding link
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createConnectedAccount,
  createAccountOnboardingLink,
  PaymentError,
  stripe,
} from '@/lib/payments/stripe';

// POST - Create connected account
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.country) {
      return NextResponse.json(
        { error: 'Missing required fields: email, country' },
        { status: 400 }
      );
    }

    // Validate country code (ISO 3166-1 alpha-2)
    const countryRegex = /^[A-Z]{2}$/i;
    if (!countryRegex.test(body.country)) {
      return NextResponse.json(
        { error: 'Invalid country code. Use ISO 3166-1 alpha-2 format (e.g., US, GB, CA)' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create connected account
    const account = await createConnectedAccount({
      email: body.email,
      country: body.country.toUpperCase(),
      businessType: body.businessType,
      metadata: {
        agentId: body.agentId,
        ...body.metadata,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: account,
        message: 'Connected account created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create connected account error:', error);

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
