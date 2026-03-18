/**
 * Earnings & Wallet Types for Agent Dashboard
 * 
 * Defines types for agent earnings, wallet balances, withdrawals,
 * and user deposits. References spec sections 3.1-3.4 for earnings logic.
 */

// ============================================
// WALLET TYPES
// ============================================

export interface AgentWallet {
  id: string;
  agentId: string;
  balance: number; // Current available balance in cents
  pendingBalance: number; // Pending/waiting for clearance
  totalEarned: number; // Lifetime earnings
  currency: string;
  stripeConnectedAccountId?: string;
  cryptoWalletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserWallet {
  id: string;
  userId: string;
  balance: number; // Current balance in cents
  currency: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// EARNINGS TYPES (Spec Section 3.1-3.2)
// ============================================

export type EarningType = 
  | 'task_completion'      // Task completed successfully
  | 'subscription_share'   // Subscription revenue share
  | 'bonus'               // Platform bonuses
  | 'referral'            // Referral commissions
  | 'platform_reward';    // Special platform rewards

export type EarningStatus = 
  | 'pending'      // Waiting for task verification/payment
  | 'available'    // Available for withdrawal
  | 'withdrawn'    // Already withdrawn
  | 'held'         // In escrow/hold
  | 'cancelled';   // Cancelled/reversed

export interface Earning {
  id: string;
  agentId: string;
  type: EarningType;
  status: EarningStatus;
  amount: number; // Amount in cents
  platformFee: number; // Platform fee deducted
  netAmount: number; // Net amount after fees
  currency: string;
  
  // Task reference (if applicable)
  taskId?: string;
  taskTitle?: string;
  
  // Customer reference
  customerId?: string;
  customerName?: string;
  
  // Earnings calculation breakdown (Spec 3.3)
  breakdown?: EarningBreakdown;
  
  // Timestamps
  createdAt: string;
  availableAt?: string; // When becomes available for withdrawal
  withdrawnAt?: string;
  
  // Metadata
  description?: string;
  metadata?: Record<string, any>;
}

export interface EarningBreakdown {
  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  processingFeePercent: number;
  processingFeeAmount: number;
  netAmount: number;
  
  // For subscription shares
  subscriptionPeriod?: {
    start: string;
    end: string;
  };
  
  // For task-based earnings
  taskDuration?: number; // in minutes
  hourlyRate?: number;
}

// ============================================
// WITHDRAWAL TYPES (Spec Section 3.4)
// ============================================

export type WithdrawalMethod = 'stripe' | 'crypto' | 'bank_transfer';

export type WithdrawalStatus = 
  | 'pending'      // Request received
  | 'processing'   // Being processed
  | 'completed'    // Successfully sent
  | 'failed'       // Failed to process
  | 'cancelled';   // Cancelled by user or system

export interface WithdrawalRequest {
  id: string;
  agentId: string;
  amount: number; // Amount in cents
  currency: string;
  method: WithdrawalMethod;
  status: WithdrawalStatus;
  
  // Method-specific details
  stripeTransferId?: string;
  cryptoAddress?: string;
  cryptoTxHash?: string;
  bankAccountId?: string;
  
  // Processing details
  fee: number; // Withdrawal fee
  netAmount: number; // Amount after fees
  
  // Timestamps
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  
  // Error handling
  errorMessage?: string;
  retryCount: number;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface CreateWithdrawalRequest {
  amount: number;
  method: WithdrawalMethod;
  cryptoAddress?: string; // Required for crypto withdrawals
  bankAccountId?: string; // Required for bank transfers
}

// ============================================
// DEPOSIT TYPES
// ============================================

export type DepositMethod = 'stripe' | 'crypto';

export type DepositStatus = 
  | 'pending'      // Waiting for payment
  | 'processing'   // Payment received, processing
  | 'completed'    // Funds added to balance
  | 'failed'       // Payment failed
  | 'cancelled';   // Cancelled

export interface Deposit {
  id: string;
  userId: string;
  amount: number; // Amount in cents
  currency: string;
  method: DepositMethod;
  status: DepositStatus;
  
  // Stripe details
  stripePaymentIntentId?: string;
  
  // Crypto details
  cryptoAddress?: string;
  cryptoTxHash?: string;
  cryptoCurrency?: string; // BTC, ETH, etc.
  
  // Processing
  fee: number;
  netAmount: number;
  
  // Timestamps
  createdAt: string;
  completedAt?: string;
  expiresAt?: string; // For crypto deposits
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface CreateDepositRequest {
  amount: number;
  currency?: string;
  method: DepositMethod;
}

export interface CryptoDepositAddress {
  currency: string;
  address: string;
  qrCode: string;
  network: string;
  minDeposit: number;
  confirmationsRequired: number;
  expiresAt?: string;
}

// ============================================
// STATS & SUMMARY TYPES
// ============================================

export interface AgentEarningsStats {
  currentBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  
  // Time-based stats
  thisMonth: number;
  lastMonth: number;
  thisWeek: number;
  lastWeek: number;
  today: number;
  yesterday: number;
  
  // Counts
  totalTasksCompleted: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
}

export interface UserBalanceStats {
  currentBalance: number;
  totalDeposited: number;
  totalSpent: number;
  
  // Time-based
  thisMonthSpent: number;
  thisMonthDeposited: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface EarningsHistoryResponse {
  earnings: Earning[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: AgentEarningsStats;
}

export interface WithdrawalHistoryResponse {
  withdrawals: WithdrawalRequest[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DepositHistoryResponse {
  deposits: Deposit[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// PLATFORM EARNINGS CALCULATION (Spec 3.1-3.4)
// ============================================

export interface PlatformEarningsConfig {
  // Platform fee structure
  platformFeePercent: number; // e.g., 15 for 15%
  
  // Processing fee structure
  stripeProcessingPercent: number; // e.g., 2.9
  stripeProcessingFixed: number; // e.g., 30 cents
  
  // Minimum withdrawal amounts
  minWithdrawalStripe: number; // e.g., 1000 ($10.00)
  minWithdrawalCrypto: number; // e.g., 5000 ($50.00)
  minWithdrawalBankTransfer: number; // e.g., 5000 ($50.00)
  
  // Crypto settings
  supportedCryptoCurrencies: string[];
  cryptoNetworkFees: Record<string, number>;
  
  // Subscription revenue share
  subscriptionAgentSharePercent: number; // e.g., 70 for 70%
}

// Helper function types
export interface CalculateEarningsInput {
  grossAmount: number;
  platformFeePercent: number;
  processingFeePercent: number;
  processingFeeFixed: number;
}

export interface CalculateEarningsOutput {
  grossAmount: number;
  platformFeeAmount: number;
  processingFeeAmount: number;
  netAmount: number;
}
