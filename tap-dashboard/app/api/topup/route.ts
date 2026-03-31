/**
 * Auto-Topup Configuration API
 * GET: Get auto-topup configuration
 * POST: Configure auto-topup settings
 * DELETE: Disable auto-topup
 */

import { NextRequest, NextResponse } from 'next/server';
import { configureAutoTopup, getUserBalance } from '@/lib/payments/micropayments';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

// In-memory store for demo (replace with database)
const autoTopupStore: Map<string, {
  enabled: boolean;
  threshold: number;
  chargeAmount: number;
  maxMonthlyCharge: number;
  paymentMethodId: string;
}> = new Map();

// Rate limits
const MAX_BODY_SIZE_KB = 50;
const MAX_USERID_LENGTH = 64;
const MAX_THRESHOLD = 500; // $500 max threshold
const MAX_CHARGE_AMOUNT = 1000; // $1000 max charge
const MAX_MONTHLY_CHARGE = 5000; // $5000 max monthly

// ============================================================================
// GET: Get Auto-Topup Configuration
// ============================================================================

export async function GET(request: NextRequest) {
  const path = '/api/topup';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      const response = NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate userId format
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      const response = NextResponse.json(
        { error: 'Invalid userId format', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const config = autoTopupStore.get(userId) || {
      enabled: false,
      threshold: 5.00,
      chargeAmount: 20.00,
      maxMonthlyCharge: 100.00,
      paymentMethodId: '',
    };
    
    const balance = await getUserBalance(userId);
    
    const response = NextResponse.json({
      success: true,
      config: {
        ...config,
        currentBalance: balance.balance,
        wouldTrigger: balance.balance < config.threshold,
      },
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Failed to get configuration', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

// ============================================================================
// POST: Configure Auto-Topup
// ============================================================================

export async function POST(request: NextRequest) {
  const path = '/api/topup';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const { 
      userId, 
      enabled, 
      threshold, 
      chargeAmount, 
      maxMonthlyCharge, 
      paymentMethodId 
    } = body;
    
    if (!userId) {
      const response = NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate userId format
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      const response = NextResponse.json(
        { error: 'Invalid userId format', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate inputs
    if (enabled) {
      if (!threshold || typeof threshold !== 'number' || threshold < 1 || threshold > MAX_THRESHOLD) {
        const response = NextResponse.json(
          { error: `threshold must be between $1.00 and $${MAX_THRESHOLD}`, code: 'INVALID_THRESHOLD' },
          { status: 400 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
      
      if (!chargeAmount || typeof chargeAmount !== 'number' || chargeAmount < 5 || chargeAmount > MAX_CHARGE_AMOUNT) {
        const response = NextResponse.json(
          { error: `chargeAmount must be between $5.00 and $${MAX_CHARGE_AMOUNT}`, code: 'INVALID_CHARGE_AMOUNT' },
          { status: 400 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
      
      if (!maxMonthlyCharge || typeof maxMonthlyCharge !== 'number' || maxMonthlyCharge < chargeAmount || maxMonthlyCharge > MAX_MONTHLY_CHARGE) {
        const response = NextResponse.json(
          { error: `maxMonthlyCharge must be between chargeAmount and $${MAX_MONTHLY_CHARGE}`, code: 'INVALID_MONTHLY_LIMIT' },
          { status: 400 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
      
      if (!paymentMethodId || typeof paymentMethodId !== 'string' || paymentMethodId.length > 255) {
        const response = NextResponse.json(
          { error: 'paymentMethodId is required when enabling auto-topup', code: 'MISSING_PAYMENT_METHOD' },
          { status: 400 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
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
    
    await configureAutoTopup(userId, config);
    
    const response = NextResponse.json({
      success: true,
      config,
      message: enabled 
        ? 'Auto-topup enabled successfully' 
        : 'Auto-topup disabled successfully',
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Failed to configure auto-topup', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

// ============================================================================
// DELETE: Disable Auto-Topup
// ============================================================================

export async function DELETE(request: NextRequest) {
  const path = '/api/topup';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      const response = NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate userId format
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) {
      const response = NextResponse.json(
        { error: 'Invalid userId format', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const existing = autoTopupStore.get(userId);
    if (existing) {
      existing.enabled = false;
      autoTopupStore.set(userId, existing);
      await configureAutoTopup(userId, { enabled: false });
    }
    
    const response = NextResponse.json({
      success: true,
      message: 'Auto-topup disabled',
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[Auto-Topup API] Error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Failed to disable auto-topup', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
