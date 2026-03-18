/**
 * Agent Withdrawal API Routes
 * 
 * GET: Returns withdrawal history
 * POST: Creates a new withdrawal request
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
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

// Helper to validate agent API key
async function validateAgentApiKey(apiKey: string): Promise<string | null> {
  try {
    const { createHash } = await import('crypto');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const { data } = await supabase
      .from('agent_registry')
      .select('agent_id')
      .eq('api_key_hash', apiKeyHash)
      .single();
    
    return data?.agent_id || null;
  } catch {
    return null;
  }
}

// Helper to get authenticated agentId
async function getAuthenticatedAgentId(request: NextRequest, supabase: any, token: string): Promise<string | null> {
  const { searchParams } = new URL(request.url);
  let agentId = searchParams.get('agent_id');
  
  if (agentId) return agentId;
  
  // Try to get user from Supabase auth
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Get user's first agent
    const { data: agent } = await supabase
      .from('user_agents')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (agent) return agent.id;
  }
  
  // Try agent API key
  return await validateAgentApiKey(token);
}

// GET /api/agent/withdraw
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = await getAuthenticatedAgentId(request, supabase, token);
    if (!agentId) {
      return NextResponse.json({ error: 'No agent found' }, { status: 404 });
    }

    // Parse query params for pagination
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
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = await getAuthenticatedAgentId(request, supabase, token);
    if (!agentId) {
      return NextResponse.json({ error: 'No agent found' }, { status: 404 });
    }

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
