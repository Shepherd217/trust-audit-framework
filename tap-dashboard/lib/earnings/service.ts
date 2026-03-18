/**
 * MoltOS Earnings Service
 * 
 * Real database operations for earnings, wallets, and withdrawals.
 * Connected to Supabase backend.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  Earning, 
  EarningStatus,
  AgentWallet,
  WithdrawalRequest,
  WithdrawalStatus,
  Deposit,
  DepositStatus,
  AgentEarningsStats,
  CreateWithdrawalRequest,
  CreateDepositRequest,
  CryptoDepositAddress,
} from '@/types/earnings';
import { calculateAgentStats } from './calculations';

// Supabase client singleton
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

export async function getAgentWallet(agentId: string): Promise<AgentWallet | null> {
  try {
    const { data, error } = await getSupabase()
      .from('agent_wallets')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    
    if (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
    
    return data ? {
      id: data.id,
      agentId: data.agent_id,
      balance: data.balance,
      pendingBalance: data.pending_balance,
      totalEarned: data.total_earned,
      currency: data.currency,
      stripeConnectedAccountId: data.stripe_connected_account_id,
      cryptoWalletAddress: data.crypto_wallet_address,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } : null;
  } catch (error) {
    console.error('Unexpected error fetching wallet:', error);
    return null;
  }
}

export async function getAgentEarnings(
  agentId: string,
  options: {
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ earnings: Earning[]; total: number }> {
  const { status, type, page = 1, pageSize = 10 } = options;
  
  try {
    let query = getSupabase()
      .from('earnings')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching earnings:', error);
      return { earnings: [], total: 0 };
    }
    
    const earnings: Earning[] = (data || []).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      type: row.type,
      status: row.status,
      amount: row.amount,
      platformFee: row.platform_fee,
      netAmount: row.net_amount,
      currency: row.currency,
      taskId: row.task_id,
      taskTitle: row.task_title,
      customerId: row.customer_id,
      customerName: row.customer_name,
      breakdown: row.breakdown,
      createdAt: row.created_at,
      availableAt: row.available_at,
      withdrawnAt: row.withdrawn_at,
      description: row.description,
      metadata: row.metadata,
    }));
    
    return { earnings, total: count || 0 };
  } catch (error) {
    console.error('Unexpected error fetching earnings:', error);
    return { earnings: [], total: 0 };
  }
}

export async function getAgentStats(agentId: string): Promise<AgentEarningsStats> {
  try {
    // Get all earnings for this agent
    const { data: earnings, error } = await getSupabase()
      .from('earnings')
      .select('*')
      .eq('agent_id', agentId);
    
    if (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
    
    // Get all withdrawals
    const { data: withdrawals, error: wdError } = await getSupabase()
      .from('withdrawals')
      .select('*')
      .eq('agent_id', agentId);
    
    if (wdError) {
      console.error('Error fetching withdrawals:', wdError);
    }
    
    return calculateAgentStats(earnings || [], withdrawals || []);
  } catch (error) {
    console.error('Error calculating stats:', error);
    // Return empty stats
    return {
      currentBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      thisMonth: 0,
      lastMonth: 0,
      thisWeek: 0,
      lastWeek: 0,
      today: 0,
      yesterday: 0,
      totalTasksCompleted: 0,
      totalWithdrawals: 0,
      pendingWithdrawals: 0,
    };
  }
}

export async function createWithdrawal(
  agentId: string,
  request: CreateWithdrawalRequest
): Promise<WithdrawalRequest> {
  try {
    // Check wallet balance first
    const wallet = await getAgentWallet(agentId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    
    if (wallet.balance < request.amount) {
      throw new Error('Insufficient balance');
    }
    
    const fee = request.method === 'crypto' ? 100 : 0;
    
    const { data, error } = await getSupabase()
      .from('withdrawals')
      .insert({
        agent_id: agentId,
        amount: request.amount,
        currency: 'USD',
        method: request.method,
        status: 'pending',
        crypto_address: request.cryptoAddress,
        fee,
        net_amount: request.amount - fee,
        requested_at: new Date().toISOString(),
        retry_count: 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating withdrawal:', error);
      throw error;
    }
    
    // Deduct from wallet balance
    await getSupabase()
      .from('agent_wallets')
      .update({
        balance: wallet.balance - request.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId);
    
    return {
      id: data.id,
      agentId: data.agent_id,
      amount: data.amount,
      currency: data.currency,
      method: data.method,
      status: data.status,
      cryptoAddress: data.crypto_address,
      fee: data.fee,
      netAmount: data.net_amount,
      requestedAt: data.requested_at,
      processedAt: data.processed_at,
      completedAt: data.completed_at,
      retryCount: data.retry_count,
    };
  } catch (error) {
    console.error('Error in createWithdrawal:', error);
    throw error;
  }
}

export async function getWithdrawalHistory(
  agentId: string,
  options: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ withdrawals: WithdrawalRequest[]; total: number }> {
  const { status, page = 1, pageSize = 10 } = options;
  
  try {
    let query = getSupabase()
      .from('withdrawals')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('requested_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching withdrawals:', error);
      return { withdrawals: [], total: 0 };
    }
    
    const withdrawals: WithdrawalRequest[] = (data || []).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      amount: row.amount,
      currency: row.currency,
      method: row.method,
      status: row.status,
      stripeTransferId: row.stripe_transfer_id,
      cryptoAddress: row.crypto_address,
      cryptoTxHash: row.crypto_tx_hash,
      fee: row.fee,
      netAmount: row.net_amount,
      requestedAt: row.requested_at,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
    }));
    
    return { withdrawals, total: count || 0 };
  } catch (error) {
    console.error('Unexpected error fetching withdrawals:', error);
    return { withdrawals: [], total: 0 };
  }
}

// ============================================
// USER DEPOSIT FUNCTIONS
// ============================================

export async function getUserDeposits(
  userId: string,
  options: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ deposits: Deposit[]; total: number }> {
  const { status, page = 1, pageSize = 10 } = options;
  
  try {
    let query = getSupabase()
      .from('deposits')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching deposits:', error);
      return { deposits: [], total: 0 };
    }
    
    const deposits: Deposit[] = (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      currency: row.currency,
      method: row.method,
      status: row.status,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      cryptoAddress: row.crypto_address,
      cryptoTxHash: row.crypto_tx_hash,
      cryptoCurrency: row.crypto_currency,
      fee: row.fee,
      netAmount: row.net_amount,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
    }));
    
    return { deposits, total: count || 0 };
  } catch (error) {
    console.error('Unexpected error fetching deposits:', error);
    return { deposits: [], total: 0 };
  }
}

export async function createDeposit(
  userId: string,
  request: CreateDepositRequest
): Promise<Deposit> {
  try {
    const fee = request.method === 'stripe' ? Math.round(request.amount * 0.029) + 30 : 0;
    const netAmount = request.amount - fee;
    
    const { data, error } = await getSupabase()
      .from('deposits')
      .insert({
        user_id: userId,
        amount: request.amount,
        currency: request.currency || 'USD',
        method: request.method,
        status: 'pending',
        fee,
        net_amount: netAmount,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating deposit:', error);
      throw error;
    }
    
    return {
      id: data.id,
      userId: data.user_id,
      amount: data.amount,
      currency: data.currency,
      method: data.method,
      status: data.status,
      fee: data.fee,
      netAmount: data.net_amount,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error in createDeposit:', error);
    throw error;
  }
}

export async function getCryptoDepositAddress(
  userId: string,
  currency: string
): Promise<CryptoDepositAddress> {
  // Generate deterministic address based on userId and currency
  // In production, this would call your crypto payment processor
  const hash = await cryptoHash(userId + currency);
  
  const addresses: Record<string, { address: string; network: string }> = {
    'BTC': { address: `bc1q${hash.slice(0, 38)}`, network: 'Bitcoin' },
    'ETH': { address: `0x${hash.slice(0, 40)}`, network: 'Ethereum' },
    'USDC': { address: `0x${hash.slice(0, 40)}`, network: 'Ethereum (ERC-20)' },
    'USDT': { address: `0x${hash.slice(0, 40)}`, network: 'Ethereum (ERC-20)' },
  };
  
  const addr = addresses[currency] || addresses['BTC'];
  
  return {
    currency,
    address: addr.address,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${addr.address}`,
    network: addr.network,
    minDeposit: currency === 'BTC' ? 1000 : 500,
    confirmationsRequired: currency === 'BTC' ? 3 : 12,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function cryptoHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
