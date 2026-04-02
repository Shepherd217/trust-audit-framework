export const dynamic = 'force-dynamic';
/**
 * User Deposit API Routes
 * 
 * GET: Returns deposit history
 * POST: Creates a new deposit request
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getUserDeposits,
  createDeposit,
  getCryptoDepositAddress,
} from '@/lib/earnings/service';
import { CreateDepositRequest } from '@/types/earnings';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Rate limit: 5 deposits per minute per IP
const MAX_BODY_SIZE_KB = 50;

// Helper to get authenticated user
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized - Bearer token required' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: 'Unauthorized - Invalid token' };
  }
  
  return { user, error: null };
}

// GET /api/user/deposit
export async function GET(request: NextRequest) {
  const path = '/api/user/deposit';
  
  // Apply rate limiting
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      const response = NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
      return applySecurityHeaders(response);
    }
    
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const validPage = Math.max(1, page);
    const validPageSize = Math.min(100, Math.max(1, pageSize));

    const { deposits, total } = await getUserDeposits(userId, {
      status: status || undefined,
      page: validPage,
      pageSize: validPageSize,
    });

    const totalPages = Math.ceil(total / validPageSize);

    const response = NextResponse.json({
      success: true,
      deposits,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages,
      },
    });
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('Error fetching deposit history:', error);
    const response = NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch deposit history',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}

// POST /api/user/deposit
export async function POST(request: NextRequest) {
  const path = '/api/user/deposit';
  
  // Apply rate limiting
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    // Get authenticated user first
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      const response = NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
      return applySecurityHeaders(response);
    }

    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { success: false, error: sizeCheck.error },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }
    
    const userId = user.id;

    let body: CreateDepositRequest;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate required fields
    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Invalid amount',
          message: 'Amount must be greater than 0'
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate amount bounds (max $10,000)
    if (body.amount > 1000000) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Amount exceeds maximum',
          message: 'Maximum deposit is $10,000'
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    if (!body.method) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Missing deposit method',
          message: 'Deposit method is required'
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate method
    const validMethods = ['stripe', 'crypto', 'bank'];
    if (!validMethods.includes(body.method)) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Invalid deposit method',
          message: `Valid methods: ${validMethods.join(', ')}`
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate minimum deposit
    const minDeposit = body.method === 'stripe' ? 500 : 1000; // $5 for stripe, $10 for crypto
    if (body.amount < minDeposit) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Minimum deposit not met',
          message: `Minimum deposit for ${body.method} is $${(minDeposit / 100).toFixed(2)}`
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Create deposit
    const deposit = await createDeposit(userId, body);

    // For crypto deposits, generate deposit address
    let cryptoAddress = null;
    if (body.method === 'crypto') {
      cryptoAddress = await getCryptoDepositAddress(userId, 'BTC'); // Default to BTC
    }

    const response = NextResponse.json({
      success: true,
      deposit,
      cryptoAddress,
      message: 'Deposit initiated successfully',
    }, { status: 201 });
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('Error creating deposit:', error);
    const response = NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create deposit',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}
