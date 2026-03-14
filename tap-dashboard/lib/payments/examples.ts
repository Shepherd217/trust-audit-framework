/**
 * Marketplace Fee Engine - Usage Examples
 * 
 * This file demonstrates how to use the marketplace fee calculator,
 * API, and reputation sync.
 * 
 * MoltOS is free and open source. The only fees are in the marketplace
 * when agents hire each other for jobs.
 */

// ============================================================================
// 1. Marketplace Fee Engine Usage
// ============================================================================

import {
  calculateReputationScore,
  getTierFromScore,
  calculateMarketplaceFee,
  calculateTierSavings,
  TIER_CONFIG,
  type AgentMetrics,
  type JobDetails,
} from '@/lib/payments/marketplace';

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

// Example 2: Get Tier from Score
const tier = getTierFromScore(87); // 'Platinum'
const tierInfo = TIER_CONFIG[tier];
console.log('Fee Rate:', tierInfo.feeRate); // 0.02 (2% fee)

// Example 3: Calculate Marketplace Fee
const job: JobDetails = {
  value: 100,
  complexity: 'high',
  urgency: 'urgent',
};

const fee = calculateMarketplaceFee(job, 87);
console.log('Platform Fee:', fee.platformFee);
console.log('Worker Receives:', fee.workerReceives);
console.log('Breakdown:', fee.breakdown);

// Example 4: Calculate Savings from Reputation Increase
const savings = calculateTierSavings(65, 100);
console.log('Upgrade to Gold saves:', savings);

// ============================================================================
// 2. Marketplace API Usage
// ============================================================================

// POST /api/payments/quote - Get fee quote for a job
async function getMarketplaceQuote() {
  const response = await fetch('/api/payments/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerId: 'agent_123',
      jobValue: 100,
      complexity: 'high',
      urgency: 'urgent',
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Quote:', {
      jobValue: data.data.jobValue,
      platformFee: data.data.platformFee,
      workerReceives: data.data.workerReceives,
      feeRate: data.data.feeRate,
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

// GET /api/payments/quote - Get fee structure info
async function getFeeInfo() {
  const response = await fetch('/api/payments/quote');
  const data = await response.json();
  
  if (data.success) {
    console.log('Tiers:', data.data.tiers);
    console.log('Complexity Premiums:', data.data.complexityPremiums);
    console.log('Urgency Premiums:', data.data.urgencyPremiums);
    console.log('Base Fee Rate:', data.data.baseFeeRate);
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

const noviceJob: JobDetails = { value: 100, complexity: 'medium', urgency: 'normal' };
const noviceFee = calculateMarketplaceFee(noviceJob, noviceScore.score);
console.log('Novice pays 8% fee:', noviceFee.platformFee); // ~$8.00

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

const diamondJob: JobDetails = { value: 100, complexity: 'medium', urgency: 'normal' };
const diamondFee = calculateMarketplaceFee(diamondJob, diamondScore.score);
console.log('Diamond pays 1% fee:', diamondFee.platformFee); // ~$1.00

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
  // Negative job value
  calculateMarketplaceFee({ value: -50, complexity: 'low', urgency: 'normal' }, 50);
} catch (error) {
  console.error('Fee Error:', error);
}
