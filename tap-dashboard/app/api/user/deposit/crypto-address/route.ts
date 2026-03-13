export const dynamic = 'force-dynamic';

/**
 * Crypto Deposit Address API Route
 * 
 * GET: Returns a new crypto deposit address for the specified currency
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCryptoDepositAddress } from '@/lib/earnings/service';

// GET /api/user/deposit/crypto-address?currency=BTC
export async function GET(request: NextRequest) {
  try {
    // In production, get userId from authenticated session
    const userId = 'user_123'; // Mock for now

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'BTC';

    // Validate currency
    const supportedCurrencies = ['BTC', 'ETH', 'USDC', 'USDT'];
    if (!supportedCurrencies.includes(currency)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unsupported currency',
          message: `Supported currencies: ${supportedCurrencies.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Generate deposit address
    const address = await getCryptoDepositAddress(userId, currency);

    return NextResponse.json({
      success: true,
      address,
    });

  } catch (error) {
    console.error('Error generating crypto address:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate deposit address',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
