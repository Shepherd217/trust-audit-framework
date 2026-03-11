/**
 * User Deposit API Routes
 * 
 * GET: Returns deposit history
 * POST: Creates a new deposit request
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserDeposits,
  createDeposit,
  getCryptoDepositAddress,
} from '@/lib/earnings/service';
import { CreateDepositRequest } from '@/types/earnings';

// GET /api/user/deposit
export async function GET(request: NextRequest) {
  try {
    // In production, get userId from authenticated session
    const userId = 'user_123'; // Mock for now

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

    return NextResponse.json({
      success: true,
      deposits,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Error fetching deposit history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch deposit history',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/user/deposit
export async function POST(request: NextRequest) {
  try {
    // In production, get userId from authenticated session
    const userId = 'user_123'; // Mock for now

    const body: CreateDepositRequest = await request.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid amount',
          message: 'Amount must be greater than 0'
        },
        { status: 400 }
      );
    }

    if (!body.method) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing deposit method',
          message: 'Deposit method is required'
        },
        { status: 400 }
      );
    }

    // Validate minimum deposit
    const minDeposit = body.method === 'stripe' ? 500 : 1000; // $5 for stripe, $10 for crypto
    if (body.amount < minDeposit) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Minimum deposit not met',
          message: `Minimum deposit for ${body.method} is $${(minDeposit / 100).toFixed(2)}`
        },
        { status: 400 }
      );
    }

    // Create deposit
    const deposit = await createDeposit(userId, body);

    // For crypto deposits, generate deposit address
    let cryptoAddress = null;
    if (body.method === 'crypto') {
      cryptoAddress = await getCryptoDepositAddress(userId, 'BTC'); // Default to BTC
    }

    return NextResponse.json({
      success: true,
      deposit,
      cryptoAddress,
      message: 'Deposit initiated successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating deposit:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create deposit',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
