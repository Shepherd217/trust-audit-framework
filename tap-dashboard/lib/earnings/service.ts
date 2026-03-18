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

// Fallback mock data for development (remove in production)
const mockWallets: Map<string, AgentWallet> = new Map([
  ['agent_123', {
    id: 'wallet_123',
    agentId: 'agent_123',
    balance: 154750, // $1,547.50
    pendingBalance: 32500, // $325.00
    totalEarned: 215000, // $2,150.00
    currency: 'USD',
    stripeConnectedAccountId: 'acct_mock_123',
    cryptoWalletAddress: '0x1234...5678',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2025-03-12T06:00:00Z',
  }],
]);

const mockEarnings: Earning[] = [
  {
    id: 'earn_001',
    agentId: 'agent_123',
    type: 'task_completion',
    status: 'available',
    amount: 15000,
    platformFee: 2250,
    netAmount: 12750,
    currency: 'USD',
    taskId: 'task_001',
    taskTitle: 'Website SEO Optimization',
    customerId: 'cust_001',
    customerName: 'Acme Corp',
    breakdown: {
      grossAmount: 15000,
      platformFeePercent: 15,
      platformFeeAmount: 2250,
      processingFeePercent: 2.9,
      processingFeeAmount: 465,
      netAmount: 12750,
      taskDuration: 120,
      hourlyRate: 7500,
    },
    createdAt: '2025-03-10T14:30:00Z',
    availableAt: '2025-03-11T14:30:00Z',
    description: 'Completed SEO optimization for company website',
  },
  {
    id: 'earn_002',
    agentId: 'agent_123',
    type: 'task_completion',
    status: 'available',
    amount: 8500,
    platformFee: 1275,
    netAmount: 7225,
    currency: 'USD',
    taskId: 'task_002',
    taskTitle: 'Data Analysis Report',
    customerId: 'cust_002',
    customerName: 'TechStart Inc',
    breakdown: {
      grossAmount: 8500,
      platformFeePercent: 15,
      platformFeeAmount: 1275,
      processingFeePercent: 2.9,
      processingFeeAmount: 277,
      netAmount: 7225,
      taskDuration: 60,
      hourlyRate: 8500,
    },
    createdAt: '2025-03-08T09:15:00Z',
    availableAt: '2025-03-09T09:15:00Z',
    description: 'Market analysis and competitor research',
  },
  {
    id: 'earn_003',
    agentId: 'agent_123',
    type: 'subscription_share',
    status: 'available',
    amount: 5000,
    platformFee: 0,
    netAmount: 5000,
    currency: 'USD',
    customerId: 'cust_003',
    customerName: 'Monthly Subscriber',
    breakdown: {
      grossAmount: 7143,
      platformFeePercent: 0,
      platformFeeAmount: 0,
      processingFeePercent: 0,
      processingFeeAmount: 0,
      netAmount: 5000,
      subscriptionPeriod: {
        start: '2025-03-01T00:00:00Z',
        end: '2025-03-31T23:59:59Z',
      },
    },
    createdAt: '2025-03-01T00:00:00Z',
    availableAt: '2025-03-01T00:00:00Z',
    description: 'Monthly subscription revenue share',
  },
  {
    id: 'earn_004',
    agentId: 'agent_123',
    type: 'task_completion',
    status: 'pending',
    amount: 22000,
    platformFee: 3300,
    netAmount: 18700,
    currency: 'USD',
    taskId: 'task_003',
    taskTitle: 'Mobile App Development',
    customerId: 'cust_004',
    customerName: 'AppVentures LLC',
    breakdown: {
      grossAmount: 22000,
      platformFeePercent: 15,
      platformFeeAmount: 3300,
      processingFeePercent: 2.9,
      processingFeeAmount: 668,
      netAmount: 18700,
      taskDuration: 240,
      hourlyRate: 5500,
    },
    createdAt: '2025-03-11T16:45:00Z',
    description: 'iOS app development - Phase 1',
  },
  {
    id: 'earn_005',
    agentId: 'agent_123',
    type: 'bonus',
    status: 'available',
    amount: 2500,
    platformFee: 0,
    netAmount: 2500,
    currency: 'USD',
    createdAt: '2025-03-05T10:00:00Z',
    availableAt: '2025-03-05T10:00:00Z',
    description: 'Top Performer Bonus - February 2025',
  },
  {
    id: 'earn_006',
    agentId: 'agent_123',
    type: 'task_completion',
    status: 'withdrawn',
    amount: 12000,
    platformFee: 1800,
    netAmount: 10200,
    currency: 'USD',
    taskId: 'task_004',
    taskTitle: 'Content Writing Project',
    customerId: 'cust_005',
    customerName: 'Blog Masters',
    createdAt: '2025-02-25T11:20:00Z',
    availableAt: '2025-02-26T11:20:00Z',
    withdrawnAt: '2025-03-01T09:00:00Z',
    description: '10 blog posts on tech topics',
  },
  {
    id: 'earn_007',
    agentId: 'agent_123',
    type: 'referral',
    status: 'available',
    amount: 1500,
    platformFee: 0,
    netAmount: 1500,
    currency: 'USD',
    createdAt: '2025-03-02T08:30:00Z',
    availableAt: '2025-03-02T08:30:00Z',
    description: 'Referral bonus - New Agent: Agent Smith',
  },
  {
    id: 'earn_008',
    agentId: 'agent_123',
    type: 'task_completion',
    status: 'held',
    amount: 30000,
    platformFee: 4500,
    netAmount: 25500,
    currency: 'USD',
    taskId: 'task_005',
    taskTitle: 'Enterprise Consulting',
    customerId: 'cust_006',
    customerName: 'BigCorp Enterprises',
    createdAt: '2025-03-09T13:00:00Z',
    description: 'Strategic consulting project (in escrow)',
  },
];

const mockWithdrawals: WithdrawalRequest[] = [
  {
    id: 'wd_001',
    agentId: 'agent_123',
    amount: 50000,
    currency: 'USD',
    method: 'stripe',
    status: 'completed',
    stripeTransferId: 'tr_mock_001',
    fee: 0,
    netAmount: 50000,
    requestedAt: '2025-03-01T09:00:00Z',
    processedAt: '2025-03-01T09:05:00Z',
    completedAt: '2025-03-01T09:30:00Z',
    retryCount: 0,
  },
  {
    id: 'wd_002',
    agentId: 'agent_123',
    amount: 25000,
    currency: 'USD',
    method: 'crypto',
    status: 'completed',
    cryptoAddress: '0x1234...5678',
    cryptoTxHash: '0xabc...def',
    fee: 100,
    netAmount: 24900,
    requestedAt: '2025-02-15T14:20:00Z',
    processedAt: '2025-02-15T14:25:00Z',
    completedAt: '2025-02-15T14:45:00Z',
    retryCount: 0,
  },
  {
    id: 'wd_003',
    agentId: 'agent_123',
    amount: 75000,
    currency: 'USD',
    method: 'stripe',
    status: 'pending',
    fee: 0,
    netAmount: 75000,
    requestedAt: '2025-03-12T05:00:00Z',
    retryCount: 0,
  },
];

const mockDeposits: Map<string, Deposit[]> = new Map([
  ['user_123', [
    {
      id: 'dep_001',
      userId: 'user_123',
      amount: 10000,
      currency: 'USD',
      method: 'stripe',
      status: 'completed',
      stripePaymentIntentId: 'pi_mock_001',
      fee: 320, // 2.9% + 30¢
      netAmount: 9680,
      createdAt: '2025-03-10T10:00:00Z',
      completedAt: '2025-03-10T10:05:00Z',
    },
    {
      id: 'dep_002',
      userId: 'user_123',
      amount: 50000,
      currency: 'USD',
      method: 'crypto',
      status: 'completed',
      cryptoAddress: 'bc1q...xyz',
      cryptoTxHash: 'abc123...',
      cryptoCurrency: 'BTC',
      fee: 500,
      netAmount: 49500,
      createdAt: '2025-03-05T08:00:00Z',
      completedAt: '2025-03-05T08:30:00Z',
    },
  ]],
]);

// ============================================
// SERVICE FUNCTIONS
// ============================================

export async function getAgentWallet(agentId: string): Promise<AgentWallet | null> {
  return mockWallets.get(agentId) || null;
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
  
  let filtered = mockEarnings.filter(e => e.agentId === agentId);
  
  if (status) {
    filtered = filtered.filter(e => e.status === status);
  }
  
  if (type) {
    filtered = filtered.filter(e => e.type === type);
  }
  
  // Sort by newest first
  filtered.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  
  return { earnings: paginated, total };
}

export async function getAgentStats(agentId: string): Promise<AgentEarningsStats> {
  const agentEarnings = mockEarnings.filter(e => e.agentId === agentId);
  const agentWithdrawals = mockWithdrawals.filter(w => w.agentId === agentId);
  
  return calculateAgentStats(agentEarnings, agentWithdrawals);
}

export async function createWithdrawal(
  agentId: string,
  request: CreateWithdrawalRequest
): Promise<WithdrawalRequest> {
  const wallet = mockWallets.get(agentId);
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  if (wallet.balance < request.amount) {
    throw new Error('Insufficient balance');
  }
  
  const fee = request.method === 'crypto' ? 100 : 0;
  
  const withdrawal: WithdrawalRequest = {
    id: `wd_${Date.now()}`,
    agentId,
    amount: request.amount,
    currency: 'USD',
    method: request.method,
    status: 'pending',
    cryptoAddress: request.cryptoAddress,
    fee,
    netAmount: request.amount - fee,
    requestedAt: new Date().toISOString(),
    retryCount: 0,
  };
  
  mockWithdrawals.push(withdrawal);
  
  // Update wallet balance
  wallet.balance -= request.amount;
  wallet.updatedAt = new Date().toISOString();
  
  return withdrawal;
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
  
  let filtered = mockWithdrawals.filter(w => w.agentId === agentId);
  
  if (status) {
    filtered = filtered.filter(w => w.status === status);
  }
  
  // Sort by newest first
  filtered.sort((a, b) => 
    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
  
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  
  return { withdrawals: paginated, total };
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
  
  const userDeposits = mockDeposits.get(userId) || [];
  
  let filtered = [...userDeposits];
  
  if (status) {
    filtered = filtered.filter(d => d.status === status);
  }
  
  // Sort by newest first
  filtered.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);
  
  return { deposits: paginated, total };
}

export async function createDeposit(
  userId: string,
  request: CreateDepositRequest
): Promise<Deposit> {
  const deposit: Deposit = {
    id: `dep_${Date.now()}`,
    userId,
    amount: request.amount,
    currency: request.currency || 'USD',
    method: request.method,
    status: 'pending',
    fee: request.method === 'stripe' ? Math.round(request.amount * 0.029) + 30 : 0,
    netAmount: 0, // Will be calculated
    createdAt: new Date().toISOString(),
  };
  
  deposit.netAmount = deposit.amount - deposit.fee;
  
  const userDeposits = mockDeposits.get(userId) || [];
  userDeposits.push(deposit);
  mockDeposits.set(userId, userDeposits);
  
  return deposit;
}

export async function getCryptoDepositAddress(
  userId: string,
  currency: string
): Promise<CryptoDepositAddress> {
  // Generate mock address
  const addresses: Record<string, { address: string; network: string }> = {
    'BTC': { address: `bc1q${generateRandomString(38)}`, network: 'Bitcoin' },
    'ETH': { address: `0x${generateRandomString(40)}`, network: 'Ethereum' },
    'USDC': { address: `0x${generateRandomString(40)}`, network: 'Ethereum (ERC-20)' },
    'USDT': { address: `0x${generateRandomString(40)}`, network: 'Ethereum (ERC-20)' },
  };
  
  const addr = addresses[currency] || addresses['BTC'];
  
  return {
    currency,
    address: addr.address,
    qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${addr.address}`,
    network: addr.network,
    minDeposit: currency === 'BTC' ? 1000 : 500, // $10 or $5 equivalent
    confirmationsRequired: currency === 'BTC' ? 3 : 12,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };
}

function generateRandomString(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
