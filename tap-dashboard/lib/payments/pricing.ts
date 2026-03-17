/**
 * TAP-Aware Pricing (Flat Fee Model)
 * 
 * IMPORTANT: TAP (Trust and Attestation Protocol) score is a VISIBILITY
 * and TRUST signal only — it does NOT affect pricing.
 * 
 * Per PAYMENT_LAYER_SPEC.md and TAP Protocol Model:
 * - Agents set their own rates freely
 * - No tier-based multipliers, discounts, or forced premiums
 * - Flat 2.5% platform fee only
 * - TAP score affects marketplace visibility and trust signaling only
 * - Hirers decide if price matches reputation based on transparency
 * 
 * This file provides pricing utilities for complexity/urgency factors
 * (set by agents) and platform fee calculation only.
 */

// Complexity multipliers (agent-defined, not enforced by platform)
export type ComplexityLevel = 'low' | 'medium' | 'high' | 'critical';
export type UrgencyLevel = 'normal' | 'high' | 'urgent' | 'emergency';

export interface PricingFactors {
  complexity: ComplexityLevel;
  urgency: UrgencyLevel;
}

// Agent-defined complexity factors (not enforced by TAP)
export const COMPLEXITY_FACTORS: Record<ComplexityLevel, number> = {
  low: 1.0,
  medium: 1.0,  // Agents set these; platform doesn't enforce
  high: 1.0,
  critical: 1.0,
};

// Agent-defined urgency factors (not enforced by TAP)
export const URGENCY_FACTORS: Record<UrgencyLevel, number> = {
  normal: 1.0,
  high: 1.0,    // Agents set these; platform doesn't enforce
  urgent: 1.0,
  emergency: 1.0,
};

// Platform configuration
export const PLATFORM_CONFIG = {
  feePercent: 2.5,        // Flat 2.5% platform fee
  minFeeAmount: 0.50,     // $0.50 minimum
  maxFeeAmount: 50.00,    // $50 maximum
};

export interface PriceQuote {
  agentId: string;
  basePrice: number;      // Agent's asking price
  finalPrice: number;     // What hirer pays (base + factors set by agent)
  platformFee: number;    // 2.5% flat fee
  agentEarnings: number;  // 97.5% of final price
  breakdown: {
    basePrice: number;
    complexityFactor: number;  // Agent-defined
    urgencyFactor: number;     // Agent-defined
    platformFee: number;
    agentShare: number;        // 97.5%
  };
  // TAP info (for transparency only, does NOT affect price)
  tapInfo?: {
    score: number;
    tier: string;
    attestations: number;
  };
}

/**
 * Calculate price quote
 * 
 * NOTE: TAP score is NOT used in pricing calculation.
 * It is returned for hirer transparency only.
 */
export function calculateQuote(
  agentId: string,
  basePrice: number,
  factors: PricingFactors,
  tapInfo?: { score: number; tier: string; attestations: number }
): PriceQuote {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  // Agents set their own complexity/urgency multipliers
  // Platform does not enforce these — they are agent-defined
  const complexityFactor = COMPLEXITY_FACTORS[factors.complexity];
  const urgencyFactor = URGENCY_FACTORS[factors.urgency];

  // Calculate agent's asking price (agent-controlled)
  const finalPrice = Math.round(basePrice * complexityFactor * urgencyFactor * 100) / 100;

  // Calculate platform fee (flat 2.5%)
  let platformFee = Math.max(
    PLATFORM_CONFIG.minFeeAmount,
    Math.min(
      PLATFORM_CONFIG.maxFeeAmount,
      finalPrice * (PLATFORM_CONFIG.feePercent / 100)
    )
  );

  // Agent keeps 97.5%
  const agentEarnings = finalPrice - platformFee;

  return {
    agentId,
    basePrice,
    finalPrice,
    platformFee,
    agentEarnings,
    breakdown: {
      basePrice,
      complexityFactor,
      urgencyFactor,
      platformFee,
      agentShare: 97.5,
    },
    tapInfo, // For transparency only — does NOT affect price
  };
}

/**
 * Calculate earnings breakdown for completed task
 */
export function calculateEarnings(
  taskAmount: number
): {
  grossAmount: number;
  platformFee: number;
  agentEarnings: number;
  agentSharePercent: number;
} {
  const platformFee = Math.max(
    PLATFORM_CONFIG.minFeeAmount,
    Math.min(
      PLATFORM_CONFIG.maxFeeAmount,
      taskAmount * (PLATFORM_CONFIG.feePercent / 100)
    )
  );

  return {
    grossAmount: taskAmount,
    platformFee,
    agentEarnings: taskAmount - platformFee,
    agentSharePercent: 97.5,
  };
}

/**
 * Validate pricing factors
 */
export function validatePricingFactors(factors: Partial<PricingFactors>): PricingFactors {
  const validComplexity: ComplexityLevel[] = ['low', 'medium', 'high', 'critical'];
  const validUrgency: UrgencyLevel[] = ['normal', 'high', 'urgent', 'emergency'];

  const complexity = factors.complexity || 'medium';
  const urgency = factors.urgency || 'normal';

  if (!validComplexity.includes(complexity)) {
    throw new Error(`Invalid complexity level: ${complexity}`);
  }
  if (!validUrgency.includes(urgency)) {
    throw new Error(`Invalid urgency level: ${urgency}`);
  }

  return { complexity, urgency };
}

// DEPRECATED: Reputation tiers are for TAP visibility only, NOT pricing
// These are kept for reference/comparison tools only
export const REPUTATION_TIERS = [
  { name: 'Bronze', minScore: 0, description: 'Building reputation' },
  { name: 'Silver', minScore: 2000, description: 'Established agent' },
  { name: 'Gold', minScore: 4000, description: 'Proven track record' },
  { name: 'Platinum', minScore: 6000, description: 'Top performer' },
  { name: 'Diamond', minScore: 8000, description: 'Elite agent' },
] as const;

/**
 * Get tier from TAP score (for UI/display only)
 * Does NOT affect pricing.
 */
export function getTierFromScore(score: number): string {
  for (const tier of [...REPUTATION_TIERS].reverse()) {
    if (score >= tier.minScore) return tier.name;
  }
  return 'Novice';
}

export default {
  calculateQuote,
  calculateEarnings,
  validatePricingFactors,
  getTierFromScore,
  PLATFORM_CONFIG,
  REPUTATION_TIERS,
};
