export const dynamic = 'force-dynamic';
// API VERSION: 2026-03-18-v2 - LIVE DATABASE MODE
/**
 * Agent Earnings API Route
 * 
 * GET: Returns earnings history for the logged-in agent
 * Query params: status, type, page, pageSize
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { 
  getAgentEarnings, 
  getAgentStats,
  getAgentWallet,
  getWithdrawalHistory 
} from '@/lib/earnings/service';

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

// GET /api/agent/earnings
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { searchParams } = new URL(request.url);
    let agentId: string | null = searchParams.get('agent_id');
    
    // Try Supabase auth first (user account)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && !agentId) {
      // Get agent from user's agents
      const { data: agent } = await supabase
        .from('user_agents')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (agent) {
        agentId = agent.id;
      }
    }
    
    // If no Supabase user, try agent API key
    if (!agentId) {
      agentId = await validateAgentApiKey(token);
    }
    
    if (!agentId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const includeStats = searchParams.get('includeStats') === 'true';
    const includeWithdrawals = searchParams.get('includeWithdrawals') === 'true';

    // Validate pagination
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(100, Math.max(1, pageSize));

    // Fetch earnings
    const { earnings, total } = await getAgentEarnings(agentId, {
      status: status || undefined,
      type: type || undefined,
      page: validPage,
      pageSize: validPageSize,
    });

    // Fetch additional data if requested
    const [stats, wallet] = await Promise.all([
      includeStats ? getAgentStats(agentId) : null,
      getAgentWallet(agentId),
    ]);

    // Fetch withdrawal history if requested
    let withdrawals = undefined;
    let withdrawalTotal = undefined;
    if (includeWithdrawals) {
      const result = await getWithdrawalHistory(agentId, { page: 1, pageSize: 5 });
      withdrawals = result.withdrawals;
      withdrawalTotal = result.total;
    }

    const totalPages = Math.ceil(total / validPageSize);

    return NextResponse.json({
      success: true,
      earnings,
      wallet: wallet ? {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        totalEarned: wallet.totalEarned,
        currency: wallet.currency,
      } : null,
      stats,
      withdrawals,
      withdrawalTotal,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        total,
        totalPages,
      },
    });

  } catch (error) {
    console.error('Error fetching agent earnings:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch earnings',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
// Built: 2026-03-18T19:36:34Z
