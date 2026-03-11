/**
 * Reputation-Based Pricing Engine
 * 
 * Algorithm Overview (Spec 2.3):
 * - Reputation Score (0-100) calculated from:
 *   - Completion Rate (40% weight): Tasks completed / Tasks assigned
 *   - Accuracy Score (35% weight): 1 - (Errors / Total actions)
 *   - Response Time (25% weight): Avg response time vs baseline
 * 
 * - 6 Tiers with multipliers:
 *   Novice (0-20): 1.2x
 *   Bronze (21-40): 1.1x
 *   Silver (41-60): 1.0x (baseline)
 *   Gold (61-75): 0.9x
 *   Platinum (76-90): 0.85x
 *   Diamond (91-100): 0.8x
 * 
 * - Dynamic Pricing:
 *   Final Price = Base Price × Tier Multiplier × Complexity Factor × Urgency Factor
 */

// ============================================================================
// Types
// ============================================================================

export type ReputationTier = 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface TierConfig {
  name: ReputationTier;
  minScore: number;
  maxScore: number;
  multiplier: number;
  description: string;
  benefits: string[];
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksAssigned: number;
  errors: number;
  totalActions: number;
  avgResponseTimeMs: number; // Average response time in milliseconds
  baselineResponseTimeMs: number; // Expected baseline response time
}

export interface ReputationScore {
  score: number; // 0-100
  completionRate: number; // 0-1
  accuracyScore: number; // 0-1
  responseTimeScore: number; // 0-1
  breakdown: {
    completionContribution: number;
    accuracyContribution: number;
    responseTimeContribution: number;
  };
}

export interface PricingFactors {
  complexity: 'low' | 'medium' | 'high' | 'critical'; // Complexity level
  urgency: 'normal' | 'high' | 'urgent' | 'emergency'; // Urgency level
}

export interface PriceQuote {
  agentId: string;
  basePrice: number;
  finalPrice: number;
  multiplier: number;
  tier: ReputationTier;
  breakdown: {
    basePrice: number;
    tierMultiplier: number;
    tierDiscount: number;
    complexityFactor: number;
    complexityPremium: number;
    urgencyFactor: number;
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
// Tier Configuration
// ============================================================================

export const TIER_CONFIG: Record<ReputationTier, TierConfig> = {
  Novice: {
    name: 'Novice',
    minScore: 0,
    maxScore: 20,
    multiplier: 1.2,
    description: 'New agent building reputation',
    benefits: ['Access to basic tasks', 'Standard support'],
  },
  Bronze: {
    name: 'Bronze',
    minScore: 21,
    maxScore: 40,
    multiplier: 1.1,
    description: 'Established agent with proven track record',
    benefits: ['Access to standard tasks', 'Priority support'],
  },
  Silver: {
    name: 'Silver',
    minScore: 41,
    maxScore: 60,
    multiplier: 1.0,
    description: 'Reliable agent at baseline pricing',
    benefits: ['Access to advanced tasks', 'Priority matching', 'Reduced fees'],
  },
  Gold: {
    name: 'Gold',
    minScore: 61,
    maxScore: 75,
    multiplier: 0.9,
    description: 'High-performing agent with discount pricing',
    benefits: ['Access to premium tasks', 'VIP support', 'Reduced fees', 'Early access'],
  },
  Platinum: {
    name: 'Platinum',
    minScore: 76,
    maxScore: 90,
    multiplier: 0.85,
    description: 'Elite agent with significant discounts',
    benefits: ['Access to all tasks', 'VIP support', 'Maximum fee reduction', 'Beta features'],
  },
  Diamond: {
    name: 'Diamond',
    minScore: 91,
    maxScore: 100,
    multiplier: 0.8,
    description: 'Top-tier agent with best pricing',
    benefits: ['Access to exclusive tasks', 'White-glove support', 'Minimum fees', 'Advisory role'],
  },
};

// Weights for reputation score calculation (Spec 2.3)
const WEIGHTS = {
  completionRate: 0.40, // 40% weight
  accuracy: 0.35,       // 35% weight
  responseTime: 0.25,   // 25% weight
};

// Complexity factors
const COMPLEXITY_FACTORS: Record<PricingFactors['complexity'], number> = {
  low: 1.0,
  medium: 1.15,
  high: 1.35,
  critical: 1.6,
};

// Urgency factors
const URGENCY_FACTORS: Record<PricingFactors['urgency'], number> = {
  normal: 1.0,
  high: 1.2,
  urgent: 1.5,
  emergency: 2.0,
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate reputation score from agent metrics
 * Spec 2.3: Score = (Completion × 0.4) + (Accuracy × 0.35) + (ResponseTime × 0.25)
 * 
 * @param metrics - Agent performance metrics
 * @returns ReputationScore with detailed breakdown
 */
export function calculateReputationScore(metrics: AgentMetrics): ReputationScore {
  // Validate inputs
  if (metrics.tasksAssigned < 0 || metrics.tasksCompleted < 0) {
    throw new Error('Task counts cannot be negative');
  }
  if (metrics.totalActions < 0 || metrics.errors < 0) {
    throw new Error('Action counts cannot be negative');
  }
  if (metrics.avgResponseTimeMs < 0 || metrics.baselineResponseTimeMs <= 0) {
    throw new Error('Invalid response time values');
  }

  // Calculate Completion Rate (0-1)
  const completionRate = metrics.tasksAssigned > 0
    ? Math.min(metrics.tasksCompleted / metrics.tasksAssigned, 1)
    : 0;

  // Calculate Accuracy Score (0-1)
  const accuracyScore = metrics.totalActions > 0
    ? Math.max(0, 1 - (metrics.errors / metrics.totalActions))
    : 1; // Default to perfect accuracy for new agents

  // Calculate Response Time Score (0-1)
  // Faster than baseline = 1.0, 2x baseline = 0.5, 3x+ baseline = 0.0
  const responseTimeRatio = metrics.avgResponseTimeMs / metrics.baselineResponseTimeMs;
  const responseTimeScore = Math.max(0, Math.min(1, 1 - (responseTimeRatio - 1) * 0.5));

  // Calculate weighted score (0-100)
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

  // Fallback (should never reach here with valid config)
  return 'Novice';
}

/**
 * Calculate dynamic price based on reputation and task factors
 * Spec 2.3: Final Price = Base × TierMultiplier × Complexity × Urgency
 * 
 * @param basePrice - Base price for the task
 * @param reputationScore - Agent's reputation score
 * @param factors - Complexity and urgency factors
 * @returns Object with final price and breakdown
 */
export function calculateDynamicPrice(
  basePrice: number,
  reputationScore: number,
  factors: PricingFactors
): {
  finalPrice: number;
  multiplier: number;
  tier: ReputationTier;
  breakdown: PriceQuote['breakdown'];
} {
  if (basePrice < 0) {
    throw new Error('Base price cannot be negative');
  }

  // Get tier and multiplier
  const tier = getTierFromScore(reputationScore);
  const tierConfig = TIER_CONFIG[tier];
  const tierMultiplier = tierConfig.multiplier;

  // Get complexity and urgency factors
  const complexityFactor = COMPLEXITY_FACTORS[factors.complexity];
  const urgencyFactor = URGENCY_FACTORS[factors.urgency];

  // Calculate total multiplier
  const totalMultiplier = tierMultiplier * complexityFactor * urgencyFactor;

  // Calculate final price (rounded to 2 decimal places)
  const finalPrice = Math.round(basePrice * totalMultiplier * 100) / 100;

  // Calculate breakdown values
  const tierDiscount = basePrice * (1 - tierMultiplier);
  const complexityPremium = basePrice * (complexityFactor - 1);
  const urgencyPremium = basePrice * (urgencyFactor - 1);

  return {
    finalPrice,
    multiplier: Math.round(totalMultiplier * 1000) / 1000,
    tier,
    breakdown: {
      basePrice,
      tierMultiplier,
      tierDiscount: Math.round(tierDiscount * 100) / 100,
      complexityFactor,
      complexityPremium: Math.round(complexityPremium * 100) / 100,
      urgencyFactor,
      urgencyPremium: Math.round(urgencyPremium * 100) / 100,
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
    return undefined; // Already at max tier
  }

  const nextTierName = tierNames[currentIndex + 1];
  const nextTierConfig = TIER_CONFIG[nextTierName];
  
  return {
    tier: nextTierName,
    pointsNeeded: nextTierConfig.minScore - currentScore,
  };
}

/**
 * Generate a complete price quote for an agent
 * 
 * @param agentId - Agent identifier
 * @param basePrice - Base task price
 * @param reputationScore - Agent's reputation score
 * @param factors - Pricing factors
 * @returns Complete price quote
 */
export function generatePriceQuote(
  agentId: string,
  basePrice: number,
  reputationScore: number,
  factors: PricingFactors
): PriceQuote {
  const priceResult = calculateDynamicPrice(basePrice, reputationScore, factors);
  const nextTier = getNextTierInfo(reputationScore);

  return {
    agentId,
    basePrice,
    finalPrice: priceResult.finalPrice,
    multiplier: priceResult.multiplier,
    tier: priceResult.tier,
    breakdown: priceResult.breakdown,
    reputation: {
      score: reputationScore,
      tier: priceResult.tier,
      nextTier: nextTier?.tier,
      pointsToNextTier: nextTier?.pointsNeeded,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate pricing factors input
 */
export function validatePricingFactors(factors: Partial<PricingFactors>): PricingFactors {
  const validComplexity: PricingFactors['complexity'][] = ['low', 'medium', 'high', 'critical'];
  const validUrgency: PricingFactors['urgency'][] = ['normal', 'high', 'urgent', 'emergency'];

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

/**
 * Get all tier information for UI display
 */
export function getAllTiers(): TierConfig[] {
  return Object.values(TIER_CONFIG);
}

/**
 * Estimate price range for a task
 */
export function estimatePriceRange(
  basePrice: number,
  factors: PricingFactors
): { min: number; max: number; average: number } {
  const minTier = TIER_CONFIG.Diamond;
  const maxTier = TIER_CONFIG.Novice;
  
  const minPrice = calculateDynamicPrice(basePrice, minTier.minScore, factors);
  const maxPrice = calculateDynamicPrice(basePrice, maxTier.minScore, factors);
  
  return {
    min: minPrice.finalPrice,
    max: maxPrice.finalPrice,
    average: Math.round(((minPrice.finalPrice + maxPrice.finalPrice) / 2) * 100) / 100,
  };
}

export default {
  calculateReputationScore,
  getTierFromScore,
  calculateDynamicPrice,
  generatePriceQuote,
  getNextTierInfo,
  validatePricingFactors,
  getAllTiers,
  estimatePriceRange,
  TIER_CONFIG,
  WEIGHTS,
  COMPLEXITY_FACTORS,
  URGENCY_FACTORS,
};