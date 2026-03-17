/**
 * Auto-Topup Configuration API
 * GET: Get auto-topup configuration
 * POST: Configure auto-topup settings
 * DELETE: Disable auto-topup
 */

import { NextRequest, NextResponse } from 'next/server';
import { configureAutoTopup, getUserBalance } from '@/lib/payments/micropayments';

// In-memory store for demo (replace with database)
const autoTopupStore: Map<string, {
  enabled: boolean;
  threshold: number;
  chargeAmount: number;
  maxMonthlyCharge: number;
  paymentMethodId: string;
}> = new Map();

// ============================================================================
// GET: Get Auto-Topup Configuration
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
    
    const config = autoTopupStore.get(userId) || {
      enabled: false,
      threshold: 5.00,
      chargeAmount: 20.00,
      maxMonthlyCharge: 100.00,
      paymentMethodId: '',
    };
    
    const balance = await getUserBalance(userId);
    
    return NextResponse.json({
      success: true,
      config: {
        ...config,
        currentBalance: balance.balance,
        wouldTrigger: balance.balance < config.threshold,
      },
    });
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get configuration', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Configure Auto-Topup
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      enabled, 
      threshold, 
      chargeAmount, 
      maxMonthlyCharge, 
      paymentMethodId 
    } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    // Validate inputs
    if (enabled) {
      if (!threshold || threshold < 1) {
        return NextResponse.json(
          { error: 'threshold must be at least $1.00', code: 'INVALID_THRESHOLD' },
          { status: 400 }
        );
      }
      
      if (!chargeAmount || chargeAmount < 5) {
        return NextResponse.json(
          { error: 'chargeAmount must be at least $5.00', code: 'INVALID_CHARGE_AMOUNT' },
          { status: 400 }
        );
      }
      
      if (!maxMonthlyCharge || maxMonthlyCharge < chargeAmount) {
        return NextResponse.json(
          { error: 'maxMonthlyCharge must be at least chargeAmount', code: 'INVALID_MONTHLY_LIMIT' },
          { status: 400 }
        );
      }
      
      if (!paymentMethodId) {
        return NextResponse.json(
          { error: 'paymentMethodId is required when enabling auto-topup', code: 'MISSING_PAYMENT_METHOD' },
          { status: 400 }
        );
      }
    }
    
    const config = {
      enabled: enabled ?? false,
      threshold: threshold ?? 5.00,
      chargeAmount: chargeAmount ?? 20.00,
      maxMonthlyCharge: maxMonthlyCharge ?? 100.00,
      paymentMethodId: paymentMethodId ?? '',
    };
    
    autoTopupStore.set(userId, config);
    
    // Also update in micropayment service
    await configureAutoTopup(userId, config);
    
    return NextResponse.json({
      success: true,
      config,
      message: enabled 
        ? 'Auto-topup enabled successfully' 
        : 'Auto-topup disabled successfully',
    });
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to configure auto-topup', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Disable Auto-Topup
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    const existing = autoTopupStore.get(userId);
    if (existing) {
      existing.enabled = false;
      autoTopupStore.set(userId, existing);
      await configureAutoTopup(userId, { enabled: false });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Auto-topup disabled',
    });
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disable auto-topup', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }
}