/**
 * Agent Withdrawal API Routes
 * 
 * GET: Returns withdrawal history
 * POST: Creates a new withdrawal request
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createWithdrawal,
  getWithdrawalHistory,
  getAgentWallet,
} from '@/lib/earnings/service';
import { 
  meetsMinimumWithdrawal,
  calculateWithdrawalFee 
} from '@/lib/earnings/calculations';
import { CreateWithdrawalRequest } from '@/types/earnings';

// GET /api/agent/withdraw
export async function GET(request: NextRequest) {
  try {
    // In production, get agentId from authenticated session
    const agentId = 'agent_123'; // Mock for now

    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const validPage = Math.max(1, page);
    const validPageSize = Math.min(100, Math.max(1, pageSize));

    const { withdrawals, total } = await getWithdrawalHistory(agentId, {
      status: status || undefined,
      page: validPage,
      pageSize: validPageSize,
    });

    const totalPages = Math.ceil(total / validPageSize);

    return NextResponse.json({
      success: true,
      withdrawals,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch withdrawal history',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/agent/withdraw
export async function POST(request: NextRequest) {
  try {
    // In production, get agentId from authenticated session
    const agentId = 'agent_123'; // Mock for now

    const body: CreateWithdrawalRequest = await request.json();

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
          error: 'Missing withdrawal method',
          message: 'Withdrawal method is required'
        },
        { status: 400 }
      );
    }

    // Validate minimum withdrawal amount
    const { valid, minimum } = meetsMinimumWithdrawal(body.amount, body.method);
    if (!valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Minimum withdrawal not met',
          message: `Minimum withdrawal for ${body.method} is $${(minimum / 100).toFixed(2)}`
        },
        { status: 400 }
      );
    }

    // Validate crypto address for crypto withdrawals
    if (body.method === 'crypto' && !body.cryptoAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing crypto address',
          message: 'Crypto address is required for crypto withdrawals'
        },
        { status: 400 }
      );
    }

    // Check wallet balance
    const wallet = await getAgentWallet(agentId);
    if (!wallet) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Wallet not found',
          message: 'Agent wallet not found'
        },
        { status: 404 }
      );
    }

    if (wallet.balance < body.amount) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient balance',
          message: `Available balance: $${(wallet.balance / 100).toFixed(2)}`,
          availableBalance: wallet.balance,
        },
        { status: 400 }
      );
    }

    // Create withdrawal
    const withdrawal = await createWithdrawal(agentId, body);

    return NextResponse.json({
      success: true,
      withdrawal,
      message: 'Withdrawal request created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating withdrawal:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create withdrawal',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
