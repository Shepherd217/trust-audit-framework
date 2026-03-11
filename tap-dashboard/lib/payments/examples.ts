/**
 * Reputation-Based Pricing Engine - Usage Examples
 * 
 * This file demonstrates how to use the pricing engine, API, and reputation sync.
 */

// ============================================================================
// 1. Pricing Engine Usage
// ============================================================================

import {
  calculateReputationScore,
  getTierFromScore,
  calculateDynamicPrice,
  generatePriceQuote,
  TIER_CONFIG,
  AgentMetrics,
  PricingFactors,
} from '@/lib/payments/pricing';

// Example 1: Calculate Reputation Score
const metrics: AgentMetrics = {
  tasksCompleted: 85,
  tasksAssigned: 100,
  errors: 3,
  totalActions: 500,
  avgResponseTimeMs: 2500,      // 2.5 seconds average
  baselineResponseTimeMs: 5000, // 5 second baseline
};

const reputation = calculateReputationScore(metrics);
console.log('Reputation Score:', reputation.score); // ~87 (Platinum tier)
console.log('Breakdown:', reputation.breakdown);
// {
//   completionContribution: 34,  // 40% weight × 85% completion
//   accuracyContribution: 34,    // 35% weight × 99.4% accuracy
//   responseTimeContribution: 19 // 25% weight × 75% speed score
// }

// Example 2: Get Tier from Score
const tier = getTierFromScore(87); // 'Platinum'
const tierInfo = TIER_CONFIG[tier];
console.log('Tier Multiplier:', tierInfo.multiplier); // 0.85

// Example 3: Calculate Dynamic Price
const basePrice = 100;
const factors: PricingFactors = {
  complexity: 'high',
  urgency: 'urgent',
};

const price = calculateDynamicPrice(basePrice, 87, factors);
console.log('Final Price:', price.finalPrice); // ~191.25
console.log('Breakdown:', price.breakdown);
// {
//   basePrice: 100,
//   tierMultiplier: 0.85,      // 15% discount for Platinum
//   tierDiscount: 15,
//   complexityFactor: 1.35,    // 35% premium for high complexity
//   complexityPremium: 35,
//   urgencyFactor: 1.5,        // 50% premium for urgent
//   urgencyPremium: 50
// }

// Example 4: Generate Complete Quote
const quote = generatePriceQuote('agent_123', 100, 87, factors);
console.log('Quote:', quote);

// ============================================================================
// 2. Pricing API Usage
// ============================================================================

// POST /api/payments/quote
async function getPriceQuote() {
  const response = await fetch('/api/payments/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'agent_123',
      basePrice: 100,
      complexity: 'high',
      urgency: 'urgent',
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Quote:', {
      agentId: data.data.agentId,
      basePrice: data.data.basePrice,
      finalPrice: data.data.finalPrice,
      multiplier: data.data.multiplier,
      tier: data.data.tier,
      breakdown: data.data.breakdown,
      reputation: data.data.reputation,
      quoteId: data.data.quoteId,
      expiresAt: data.data.expiresAt,
    });
  } else {
    console.error('Error:', data.error);
  }
}

// GET /api/payments/quote - Get pricing info
async function getPricingInfo() {
  const response = await fetch('/api/payments/quote');
  const data = await response.json();
  
  if (data.success) {
    console.log('Tiers:', data.data.tiers);
    console.log('Complexity Factors:', data.data.complexityFactors);
    console.log('Urgency Factors:', data.data.urgencyFactors);
  }
}

// ============================================================================
// 3. Reputation Sync API Usage
// ============================================================================

// POST /api/agents/sync-reputation - Single Agent
async function syncSingleAgent() {
  const response = await fetch('/api/agents/sync-reputation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'agent_123',
      metrics: {
        tasksCompleted: 85,
        tasksAssigned: 100,
        errors: 3,
        totalActions: 500,
        avgResponseTimeMs: 2500,
        baselineResponseTimeMs: 5000,
      },
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Sync Result:', {
      agentId: data.data.agentId,
      previousScore: data.data.previousScore,
      newScore: data.data.newScore,
      tier: data.data.tier,
      tierChanged: data.data.tierChanged,
      metrics: data.data.metrics,
      breakdown: data.data.breakdown,
      progressToNextTier: data.data.progressToNextTier,
    });
  }
}

// POST /api/agents/sync-reputation - Batch Update
async function syncBatchAgents() {
  const response = await fetch('/api/agents/sync-reputation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batch: [
        {
          agentId: 'agent_123',
          metrics: {
            tasksCompleted: 85,
            tasksAssigned: 100,
            errors: 3,
            totalActions: 500,
            avgResponseTimeMs: 2500,
            baselineResponseTimeMs: 5000,
          },
        },
        {
          agentId: 'agent_456',
          metrics: {
            tasksCompleted: 50,
            tasksAssigned: 100,
            errors: 10,
            totalActions: 300,
            avgResponseTimeMs: 6000,
            baselineResponseTimeMs: 5000,
          },
        },
      ],
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Batch Results:', data.data);
    if (data.partialErrors) {
      console.warn('Partial Errors:', data.partialErrors);
    }
  }
}

// GET /api/agents/sync-reputation - Get Agent Reputation
async function getAgentReputation(agentId: string) {
  const response = await fetch(`/api/agents/sync-reputation?agentId=${agentId}`);
  const data = await response.json();
  
  if (data.success) {
    console.log('Agent Reputation:', {
      agentId: data.data.agentId,
      score: data.data.score,
      tier: data.data.tier,
      metrics: data.data.metrics,
      history: data.data.history,
      updatedAt: data.data.updatedAt,
    });
  }
}

// DELETE /api/agents/sync-reputation - Reset Agent (Admin)
async function resetAgentReputation(agentId: string) {
  const response = await fetch(`/api/agents/sync-reputation?agentId=${agentId}`, {
    method: 'DELETE',
  });
  
  const data = await response.json();
  console.log('Reset Result:', data);
}

// ============================================================================
// 4. Algorithm Examples
// ============================================================================

// Example: Novice Agent (low reputation)
const noviceMetrics: AgentMetrics = {
  tasksCompleted: 10,
  tasksAssigned: 20,
  errors: 5,
  totalActions: 50,
  avgResponseTimeMs: 8000,
  baselineResponseTimeMs: 5000,
};

const noviceScore = calculateReputationScore(noviceMetrics);
console.log('Novice Score:', noviceScore.score); // ~35 (Bronze tier)

// Novice pricing (higher cost due to risk)
const novicePrice = calculateDynamicPrice(100, noviceScore.score, {
  complexity: 'medium',
  urgency: 'normal',
});
console.log('Novice Final Price:', novicePrice.finalPrice); // ~126.50 (1.1x multiplier)

// Example: Diamond Agent (high reputation)
const diamondMetrics: AgentMetrics = {
  tasksCompleted: 495,
  tasksAssigned: 500,
  errors: 2,
  totalActions: 2000,
  avgResponseTimeMs: 2000,
  baselineResponseTimeMs: 5000,
};

const diamondScore = calculateReputationScore(diamondMetrics);
console.log('Diamond Score:', diamondScore.score); // ~96 (Diamond tier)

// Diamond pricing (lower cost due to trust)
const diamondPrice = calculateDynamicPrice(100, diamondScore.score, {
  complexity: 'medium',
  urgency: 'normal',
});
console.log('Diamond Final Price:', diamondPrice.finalPrice); // ~92.00 (0.8x multiplier)

// ============================================================================
// 5. Tier Progression
// ============================================================================

// Example: Calculate progress to next tier
const currentScore = 65; // Gold tier
const nextTierMin = 76;  // Platinum threshold
const pointsNeeded = nextTierMin - currentScore; // 11 points
const progressPercent = ((currentScore - 61) / (76 - 61)) * 100; // ~27% into Gold

console.log(`Current: Gold (${currentScore})`);
console.log(`Next: Platinum (need ${pointsNeeded} more points)`);
console.log(`Progress: ${Math.round(progressPercent)}%`);

// ============================================================================
// 6. Error Handling
// ============================================================================

try {
  // Invalid metrics (tasksCompleted > tasksAssigned)
  calculateReputationScore({
    tasksCompleted: 100,
    tasksAssigned: 50, // Error: completed > assigned
    errors: 0,
    totalActions: 100,
    avgResponseTimeMs: 1000,
    baselineResponseTimeMs: 5000,
  });
} catch (error) {
  console.error('Validation Error:', error);
}

try {
  // Negative base price
  calculateDynamicPrice(-50, 50, { complexity: 'low', urgency: 'normal' });
} catch (error) {
  console.error('Price Error:', error);
}