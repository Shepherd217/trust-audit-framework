/**
 * Payment Utilities
 * 
 * Helper functions for common payment operations.
 */

import { stripe } from './stripe';

/**
 * Format amount from cents to currency string
 */
export function formatAmount(amount: number, currency: string = 'usd'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount / 100);
}

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(
  amount: number,
  feePercent: number = 15,
  minimumFee: number = 50
): number {
  return Math.max(Math.round(amount * (feePercent / 100)), minimumFee);
}

/**
 * Calculate agent payout amount
 */
export function calculateAgentPayout(
  amount: number,
  platformFeePercent: number = 2.5
): number {
  const platformFee = calculatePlatformFee(amount, platformFeePercent);
  return amount - platformFee;
}

/**
 * Validate payment amount
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Amount must be an integer (cents)' };
  }
  if (amount < 50) {
    return { valid: false, error: 'Amount must be at least $0.50 USD' };
  }
  if (amount > 99999999) {
    return { valid: false, error: 'Amount exceeds maximum allowed' };
  }
  return { valid: true };
}

/**
 * Get payment status display info
 */
export function getPaymentStatusInfo(status: string): {
  label: string;
  color: string;
  description: string;
} {
  const statuses: Record<string, { label: string; color: string; description: string }> = {
    requires_payment_method: {
      label: 'Payment Required',
      color: 'orange',
      description: 'Waiting for customer to provide payment method',
    },
    requires_confirmation: {
      label: 'Confirmation Required',
      color: 'yellow',
      description: 'Payment method requires additional confirmation',
    },
    requires_action: {
      label: 'Action Required',
      color: 'yellow',
      description: 'Customer action required (e.g., 3D Secure)',
    },
    processing: {
      label: 'Processing',
      color: 'blue',
      description: 'Payment is being processed',
    },
    requires_capture: {
      label: 'In Escrow',
      color: 'purple',
      description: 'Payment authorized, funds held in escrow',
    },
    canceled: {
      label: 'Canceled',
      color: 'red',
      description: 'Payment was canceled',
    },
    succeeded: {
      label: 'Completed',
      color: 'green',
      description: 'Payment completed successfully',
    },
  };

  return (
    statuses[status] || {
      label: status,
      color: 'gray',
      description: 'Unknown status',
    }
  );
}

/**
 * Generate a payment summary for display
 */
export function generatePaymentSummary(params: {
  amount: number;
  currency: string;
  platformFeePercent: number;
}): {
  total: string;
  platformFee: string;
  agentPayout: string;
  platformFeePercent: number;
} {
  const { amount, currency, platformFeePercent } = params;
  const platformFee = calculatePlatformFee(amount, platformFeePercent);
  const agentPayout = amount - platformFee;

  return {
    total: formatAmount(amount, currency),
    platformFee: formatAmount(platformFee, currency),
    agentPayout: formatAmount(agentPayout, currency),
    platformFeePercent,
  };
}

/**
 * Check if payment can be captured
 */
export function canCapture(status: string): boolean {
  return status === 'requires_capture';
}

/**
 * Check if payment can be refunded
 */
export function canRefund(status: string): boolean {
  return status === 'succeeded' || status === 'partially_refunded';
}

/**
 * Check if payment can be canceled
 */
export function canCancel(status: string): boolean {
  return ['requires_payment_method', 'requires_confirmation', 'requires_capture'].includes(status);
}

/**
 * Retry failed transfer with exponential backoff
 */
export async function retryTransfer(
  transferId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; transfer?: any; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait with exponential backoff
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }

      // Get original transfer details
      const originalTransfer = await stripe.transfers.retrieve(transferId);
      
      // Create new transfer
      const transfer = await stripe.transfers.create({
        amount: originalTransfer.amount,
        currency: originalTransfer.currency,
        destination: originalTransfer.destination as string,
        description: `Retry of failed transfer ${transferId}`,
        metadata: {
          ...originalTransfer.metadata,
          originalTransferId: transferId,
          retryAttempt: attempt + 1,
        },
      });

      return { success: true, transfer };
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Transfer retry failed',
        };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}
