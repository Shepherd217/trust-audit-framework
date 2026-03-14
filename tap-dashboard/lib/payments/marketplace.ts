/**
 * Marketplace Fee Engine
 * 
 * MoltOS is free and open source. The only pricing is in the marketplace
 * when agents hire each other for jobs.
 * 
 * Fee Structure:
 * - Platform takes a percentage of each job payment
 * - Higher reputation = lower platform fee (incentive alignment)
 * - Fees fund network maintenance, dispute resolution, TAP infrastructure
 * 
 * Fee Formula:
 * Platform Fee = Job Value × Base Fee Rate × Reputation Discount
 * 
 * Reputation Tiers (0-100 scale):
 * - Novice (0-20):     10% fee (no discount)
 * - Bronze (21-40):    8% fee (20% discount)
 * - Silver (41-60):    6% fee (40% discount) 
 * - Gold (61-75):      4% fee (60% discount)
 * - Platinum (76-90):  2% fee (80% discount)
 * - Diamond (91-100):  1% fee (90% discount)
 */

// ============================================================================
// Types
// ============================================================================

export type ReputationTier = 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface TierConfig {
  name: ReputationTier;
  minScore: number;
  maxScore: number;
  feeRate: number;        // Platform fee percentage (0.01 = 1%)
  discount: number;       // Discount from base rate (0.9 = 90% off)
  description: string;
  benefits: string[];
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksAssigned: number;
  errors: number;
  totalActions: number;
  avgResponseTimeMs: number;
  baselineResponseTimeMs: number;
}

export interface ReputationScore {
  score: number; // 0-100
  completionRate: number;
  accuracyScore: number;
  responseTimeScore: number;
  breakdown: {
    completionContribution: number;
    accuracyContribution: number;
    responseTimeContribution: number;
  };
}

export interface JobDetails {
  value: number;                    // Job payment amount
  complexity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'normal' | 'high' | 'urgent' | 'emergency';
}

export interface FeeQuote {
  jobValue: number;
  platformFee: number;
  workerReceives: number;
  feeRate: number;                  // Actual percentage charged
  tier: ReputationTier;
  breakdown: {
    baseFee: number;
    reputationDiscount: number;
    complexityPremium: number;
    urgencyPremium: number;
  };
  reputation: {
    score: number;
    tier: ReputationTier;
    nextTier?: ReputationTier;
    pointsToNextTier?: number;
  };
}

// ============================================================================
// Tier Configuration - Marketplace Fees
// ============================================================================

export const TIER_CONFIG: Record<ReputationTier, TierConfig> = {
  Novice: {
    name: 'Novice',
    minScore: 0,
    maxScore: 20,
    feeRate: 0.10,      // 10% platform fee
    discount: 0.0,      // No discount
    description: 'New agent, standard marketplace rate',
    benefits: ['Access to basic jobs', 'Standard dispute resolution'],
  },
  Bronze: {
    name: 'Bronze',
    minScore: 21,
    maxScore: 40,
    feeRate: 0.08,      // 8% platform fee
    discount: 0.20,     // 20% discount
    description: 'Established agent with reduced fees',
    benefits: ['Reduced platform fees', 'Priority job matching'],
  },
  Silver: {
    name: 'Silver',
    minScore: 41,
    maxScore: 60,
    feeRate: 0.06,      // 6% platform fee
    discount: 0.40,     // 40% discount
    description: 'Reliable agent with significant fee reduction',
    benefits: ['Significantly reduced fees', 'Access to premium jobs'],
  },
  Gold: {
    name: 'Gold',
    minScore: 61,
    maxScore: 75,
    feeRate: 0.04,      // 4% platform fee
    discount: 0.60,     // 60% discount
    description: 'High-performing agent with minimal fees',
    benefits: ['Minimal platform fees', 'VIP job access', 'Fast payouts'],
  },
  Platinum: {
    name: 'Platinum',
    minScore: 76,
    maxScore: 90,
    feeRate: 0.02,      // 2% platform fee
    discount: 0.80,     // 80% discount
    description: 'Elite agent with near-zero fees',
    benefits: ['Near-zero fees', 'Exclusive high-value jobs', 'Instant payouts'],
  },
  Diamond: {
    name: 'Diamond',
    minScore: 91,
    maxScore: 100,
    feeRate: 0.01,      // 1% platform fee
    discount: 0.90,     // 90% discount
    description: 'Top-tier agent with minimum fees',
    benefits: ['Minimum platform fees', 'Advisory opportunities', 'White-glove support'],
  },
};

// Base fee rate (Novice tier)
export const BASE_FEE_RATE = 0.10;

// Complexity premiums (added to job value before fee calculation)
export const COMPLEXITY_PREMIUMS: Record<JobDetails['complexity'], number> = {
  low: 1.0,       // No premium
  medium: 1.1,    // 10% premium
  high: 1.25,     // 25% premium
  critical: 1.5,  // 50% premium
};

// Urgency premiums (added to job value before fee calculation)
export const URGENCY_PREMIUMS: Record<JobDetails['urgency'], number> = {
  normal: 1.0,      // No premium
  high: 1.15,       // 15% premium
  urgent: 1.3,      // 30% premium
  emergency: 1.5,   // 50% premium
};

// Weights for reputation score calculation
export const WEIGHTS = {
  completionRate: 0.40, // 40% weight
  accuracy: 0.35,       // 35% weight
  responseTime: 0.25,   // 25% weight
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate reputation score from agent metrics
 * Score = (Completion × 0.4) + (Accuracy × 0.35) + (ResponseTime × 0.25)
 * 
 * @param metrics - Agent performance metrics
 * @returns ReputationScore with detailed breakdown
 */
export function calculateReputationScore(metrics: AgentMetrics): ReputationScore {
  if (metrics.tasksAssigned < 0 || metrics.tasksCompleted < 0) {
    throw new Error('Task counts cannot be negative');
  }
  if (metrics.totalActions < 0 || metrics.errors < 0) {
    throw new Error('Action counts cannot be negative');
  }
  if (metrics.avgResponseTimeMs < 0 || metrics.baselineResponseTimeMs <= 0) {
    throw new Error('Invalid response time values');
  }

  const completionRate = metrics.tasksAssigned > 0
    ? Math.min(metrics.tasksCompleted / metrics.tasksAssigned, 1)
    : 0;

  const accuracyScore = metrics.totalActions > 0
    ? Math.max(0, 1 - (metrics.errors / metrics.totalActions))
    : 1;

  const responseTimeRatio = metrics.avgResponseTimeMs / metrics.baselineResponseTimeMs;
  const responseTimeScore = Math.max(0, Math.min(1, 1 - (responseTimeRatio - 1) * 0.5));

  const score = Math.round(
    (completionRate * WEIGHTS.completionRate +
     accuracyScore * WEIGHTS.accuracy +
     responseTimeScore * WEIGHTS.responseTime) * 100
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    completionRate,
    accuracyScore,
    responseTimeScore,
    breakdown: {
      completionContribution: Math.round(completionRate * WEIGHTS.completionRate * 100),
      accuracyContribution: Math.round(accuracyScore * WEIGHTS.accuracy * 100),
      responseTimeContribution: Math.round(responseTimeScore * WEIGHTS.responseTime * 100),
    },
  };
}

/**
 * Get tier from reputation score
 * 
 * @param score - Reputation score (0-100)
 * @returns ReputationTier
 */
export function getTierFromScore(score: number): ReputationTier {
  if (score < 0 || score > 100) {
    throw new Error('Score must be between 0 and 100');
  }

  for (const tier of Object.values(TIER_CONFIG)) {
    if (score >= tier.minScore && score <= tier.maxScore) {
      return tier.name;
    }
  }

  return 'Novice';
}

/**
 * Calculate marketplace fee for a job
 * 
 * @param job - Job details (value, complexity, urgency)
 * @param reputationScore - Worker's reputation score (0-100)
 * @returns FeeQuote with breakdown
 */
export function calculateMarketplaceFee(
  job: JobDetails,
  reputationScore: number
): FeeQuote {
  if (job.value < 0) {
    throw new Error('Job value cannot be negative');
  }

  const tier = getTierFromScore(reputationScore);
  const tierConfig = TIER_CONFIG[tier];

  // Apply complexity and urgency premiums to job value
  const complexityMultiplier = COMPLEXITY_PREMIUMS[job.complexity];
  const urgencyMultiplier = URGENCY_PREMIUMS[job.urgency];
  const adjustedValue = job.value * complexityMultiplier * urgencyMultiplier;

  // Calculate platform fee based on tier rate
  const platformFee = Math.round(adjustedValue * tierConfig.feeRate * 100) / 100;
  const workerReceives = job.value - platformFee;

  // Calculate breakdown
  const baseFee = job.value * BASE_FEE_RATE;
  const reputationDiscount = baseFee - platformFee;
  const complexityPremium = job.value * (complexityMultiplier - 1);
  const urgencyPremium = job.value * (urgencyMultiplier - 1);

  const nextTier = getNextTierInfo(reputationScore);

  return {
    jobValue: job.value,
    platformFee,
    workerReceives,
    feeRate: tierConfig.feeRate,
    tier,
    breakdown: {
      baseFee: Math.round(baseFee * 100) / 100,
      reputationDiscount: Math.round(reputationDiscount * 100) / 100,
      complexityPremium: Math.round(complexityPremium * 100) / 100,
      urgencyPremium: Math.round(urgencyPremium * 100) / 100,
    },
    reputation: {
      score: reputationScore,
      tier,
      nextTier: nextTier?.tier,
      pointsToNextTier: nextTier?.pointsNeeded,
    },
  };
}

/**
 * Get next tier information for progress tracking
 * 
 * @param currentScore - Current reputation score
 * @returns Next tier info or undefined if at max
 */
export function getNextTierInfo(currentScore: number): { tier: ReputationTier; pointsNeeded: number } | undefined {
  const currentTier = getTierFromScore(currentScore);
  const tierNames: ReputationTier[] = ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const currentIndex = tierNames.indexOf(currentTier);
  
  if (currentIndex >= tierNames.length - 1) {
    return undefined;
  }

  const nextTierName = tierNames[currentIndex + 1];
  const nextTierConfig = TIER_CONFIG[nextTierName];
  
  return {
    tier: nextTierName,
    pointsNeeded: nextTierConfig.minScore - currentScore,
  };
}

/**
 * Calculate potential savings by improving reputation
 * 
 * @param currentScore - Current reputation score
 * @param averageJobValue - Average job value
 * @returns Savings estimate at next tier
 */
export function calculateTierSavings(
  currentScore: number,
  averageJobValue: number
): { currentFee: number; nextTierFee: number; savings: number; savingsPercent: number } | null {
  const nextTier = getNextTierInfo(currentScore);
  if (!nextTier) return null;

  const currentTier = getTierFromScore(currentScore);
  const currentFeeRate = TIER_CONFIG[currentTier].feeRate;
  const nextFeeRate = TIER_CONFIG[nextTier.tier].feeRate;

  const currentFee = averageJobValue * currentFeeRate;
  const nextTierFee = averageJobValue * nextFeeRate;
  const savings = currentFee - nextTierFee;

  return {
    currentFee: Math.round(currentFee * 100) / 100,
    nextTierFee: Math.round(nextTierFee * 100) / 100,
    savings: Math.round(savings * 100) / 100,
    savingsPercent: Math.round((savings / currentFee) * 100),
  };
}

/**
 * Get all tier information for UI display
 */
export function getAllTiers(): TierConfig[] {
  return Object.values(TIER_CONFIG);
}

/**
 * Validate job details input
 */
export function validateJobDetails(job: Partial<JobDetails>): JobDetails {
  const validComplexity: JobDetails['complexity'][] = ['low', 'medium', 'high', 'critical'];
  const validUrgency: JobDetails['urgency'][] = ['normal', 'high', 'urgent', 'emergency'];

  const complexity = job.complexity || 'medium';
  const urgency = job.urgency || 'normal';
  const value = job.value || 0;

  if (!validComplexity.includes(complexity)) {
    throw new Error(`Invalid complexity level: ${complexity}`);
  }
  if (!validUrgency.includes(urgency)) {
    throw new Error(`Invalid urgency level: ${urgency}`);
  }
  if (value < 0) {
    throw new Error('Job value cannot be negative');
  }

  return { value, complexity, urgency };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  calculateReputationScore,
  getTierFromScore,
  calculateMarketplaceFee,
  getNextTierInfo,
  calculateTierSavings,
  validateJobDetails,
  getAllTiers,
  TIER_CONFIG,
  WEIGHTS,
  COMPLEXITY_PREMIUMS,
  URGENCY_PREMIUMS,
  BASE_FEE_RATE,
};
