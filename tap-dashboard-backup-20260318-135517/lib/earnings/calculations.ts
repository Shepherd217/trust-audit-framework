/**
 * Earnings Calculation Utilities
 * 
 * Implements earnings calculation logic per spec sections 3.1-3.4
 */

import { 
  CalculateEarningsInput, 
  CalculateEarningsOutput,
  AgentEarningsStats,
  Earning,
  PlatformEarningsConfig 
} from '@/types/earnings';

// Default platform configuration
export const DEFAULT_EARNINGS_CONFIG: PlatformEarningsConfig = {
  platformFeePercent: 15, // 15% platform fee
  stripeProcessingPercent: 2.9,
  stripeProcessingFixed: 30, // 30 cents
  minWithdrawalStripe: 1000, // $10.00
  minWithdrawalCrypto: 5000, // $50.00
  minWithdrawalBankTransfer: 5000, // $50.00
  supportedCryptoCurrencies: ['BTC', 'ETH', 'USDC', 'USDT'],
  cryptoNetworkFees: {
    'BTC': 500, // $5.00
    'ETH': 200, // $2.00
    'USDC': 100, // $1.00
    'USDT': 100, // $1.00
  },
  subscriptionAgentSharePercent: 70, // 70% to agent for subscriptions
};

/**
 * Calculate net earnings after all fees (Spec 3.3)
 * 
 * Formula:
 * - Platform Fee = Gross × Platform Fee %
 * - Processing Fee = (Gross × Processing %) + Fixed
 * - Net = Gross - Platform Fee - Processing Fee
 */
export function calculateNetEarnings(
  input: CalculateEarningsInput
): CalculateEarningsOutput {
  const { 
    grossAmount, 
    platformFeePercent, 
    processingFeePercent, 
    processingFeeFixed 
  } = input;

  const platformFeeAmount = Math.round(grossAmount * (platformFeePercent / 100));
  const processingFeeAmount = Math.round(
    (grossAmount * (processingFeePercent / 100)) + processingFeeFixed
  );
  const netAmount = grossAmount - platformFeeAmount - processingFeeAmount;

  return {
    grossAmount,
    platformFeeAmount,
    processingFeeAmount,
    netAmount: Math.max(0, netAmount),
  };
}

/**
 * Calculate earnings for a task payment
 */
export function calculateTaskEarnings(
  taskAmount: number,
  config: PlatformEarningsConfig = DEFAULT_EARNINGS_CONFIG
): CalculateEarningsOutput {
  return calculateNetEarnings({
    grossAmount: taskAmount,
    platformFeePercent: config.platformFeePercent,
    processingFeePercent: config.stripeProcessingPercent,
    processingFeeFixed: config.stripeProcessingFixed,
  });
}

/**
 * Calculate subscription revenue share for agent
 */
export function calculateSubscriptionEarnings(
  subscriptionAmount: number,
  config: PlatformEarningsConfig = DEFAULT_EARNINGS_CONFIG
): number {
  const agentShare = subscriptionAmount * (config.subscriptionAgentSharePercent / 100);
  return Math.round(agentShare);
}

/**
 * Calculate withdrawal fee based on method
 */
export function calculateWithdrawalFee(
  amount: number,
  method: 'stripe' | 'crypto',
  cryptoCurrency?: string,
  config: PlatformEarningsConfig = DEFAULT_EARNINGS_CONFIG
): number {
  if (method === 'stripe') {
    // Stripe transfers typically have no fee for standard transfers
    return 0;
  }
  
  if (method === 'crypto' && cryptoCurrency) {
    return config.cryptoNetworkFees[cryptoCurrency] || 100;
  }
  
  return 0;
}

/**
 * Check if withdrawal amount meets minimum requirements
 */
export function meetsMinimumWithdrawal(
  amount: number,
  method: 'stripe' | 'crypto' | 'bank_transfer',
  config: PlatformEarningsConfig = DEFAULT_EARNINGS_CONFIG
): { valid: boolean; minimum: number } {
  let minimum: number;
  
  switch (method) {
    case 'stripe':
      minimum = config.minWithdrawalStripe;
      break;
    case 'crypto':
      minimum = config.minWithdrawalCrypto;
      break;
    case 'bank_transfer':
      minimum = config.minWithdrawalBankTransfer || 5000; // Default $50.00
      break;
    default:
      minimum = config.minWithdrawalStripe;
  }
    
  return {
    valid: amount >= minimum,
    minimum,
  };
}

/**
 * Calculate agent earnings stats from earnings history
 */
export function calculateAgentStats(
  earnings: Earning[],
  withdrawals: { amount: number; status: string }[]
): AgentEarningsStats {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const isInRange = (date: string, start: Date, end: Date) => {
    const d = new Date(date);
    return d >= start && d < end;
  };

  let currentBalance = 0;
  let pendingBalance = 0;
  let totalEarned = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  let thisWeek = 0;
  let lastWeek = 0;
  let today = 0;
  let yesterday = 0;
  let totalTasksCompleted = 0;

  for (const earning of earnings) {
    // Calculate balances
    if (earning.status === 'available') {
      currentBalance += earning.netAmount;
    } else if (earning.status === 'pending') {
      pendingBalance += earning.netAmount;
    }

    // Total earned
    if (earning.status !== 'cancelled') {
      totalEarned += earning.netAmount;
    }

    // Time-based calculations
    if (earning.status !== 'cancelled') {
      if (isInRange(earning.createdAt, startOfMonth, now)) {
        thisMonth += earning.netAmount;
      }
      if (isInRange(earning.createdAt, startOfLastMonth, startOfMonth)) {
        lastMonth += earning.netAmount;
      }
      if (isInRange(earning.createdAt, startOfWeek, now)) {
        thisWeek += earning.netAmount;
      }
      if (isInRange(earning.createdAt, startOfLastWeek, startOfWeek)) {
        lastWeek += earning.netAmount;
      }
      if (isInRange(earning.createdAt, startOfToday, now)) {
        today += earning.netAmount;
      }
      if (isInRange(earning.createdAt, startOfYesterday, startOfToday)) {
        yesterday += earning.netAmount;
      }
    }

    // Task counts
    if (earning.type === 'task_completion' && earning.status !== 'cancelled') {
      totalTasksCompleted++;
    }
  }

  // Calculate withdrawal stats
  let totalWithdrawn = 0;
  let pendingWithdrawals = 0;
  
  for (const withdrawal of withdrawals) {
    if (withdrawal.status === 'completed') {
      totalWithdrawn += withdrawal.amount;
    } else if (['pending', 'processing'].includes(withdrawal.status)) {
      pendingWithdrawals++;
    }
  }

  return {
    currentBalance,
    pendingBalance,
    totalEarned,
    totalWithdrawn,
    thisMonth,
    lastMonth,
    thisWeek,
    lastWeek,
    today,
    yesterday,
    totalTasksCompleted,
    totalWithdrawals: withdrawals.length,
    pendingWithdrawals,
  };
}

/**
 * Format cents to currency string
 */
export function formatCurrency(
  cents: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Format cents to compact currency (for large numbers)
 */
export function formatCompactCurrency(
  cents: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
  }).format(cents / 100);
}

/**
 * Format date to readable string
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  return new Date(dateString).toLocaleDateString('en-US', options);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return formatDate(dateString);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    available: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    withdrawn: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    processing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    cancelled: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
    held: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  };

  return colors[status] || colors.pending;
}

/**
 * Get earning type display label
 */
export function getEarningTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    task_completion: 'Task Completed',
    subscription_share: 'Subscription Share',
    bonus: 'Bonus',
    referral: 'Referral',
    platform_reward: 'Platform Reward',
  };

  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
