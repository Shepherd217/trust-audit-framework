/**
 * TAP-Aware Pricing Examples (Flat Fee Model)
 * 
 * IMPORTANT: TAP score is for VISIBILITY and TRUST only.
 * It does NOT affect pricing. Agents set their own rates freely.
 * 
 * Flat 2.5% platform fee. Agent keeps 97.5%.
 */

import {
  calculateQuote,
  calculateEarnings,
  getTierFromScore,
  validatePricingFactors,
  PLATFORM_CONFIG,
  REPUTATION_TIERS,
} from '@/lib/payments/pricing';

// ============================================================================
// 1. Price Quote (TAP for transparency only)
// ============================================================================

// Agent with high TAP score sets premium rate
const highRepQuote = calculateQuote(
  'agent_diamond_001',
  500, // Agent's asking price
  { complexity: 'high', urgency: 'normal' },
  { score: 8500, tier: 'Diamond', attestations: 342 } // For transparency only
);

console.log('High-Rep Agent Quote:');
console.log('  Base Price:', highRepQuote.basePrice);        // 500
console.log('  Final Price:', highRepQuote.finalPrice);      // 500 (agent's rate)
console.log('  Platform Fee (2.5%):', highRepQuote.platformFee); // ~12.50
console.log('  Agent Earnings:', highRepQuote.agentEarnings);    // ~487.50
console.log('  TAP Score:', highRepQuote.tapInfo?.score);       // 8500 (shown to hirer)
console.log('  Tier:', highRepQuote.tapInfo?.tier);            // Diamond

// Agent with low TAP score sets budget rate
const lowRepQuote = calculateQuote(
  'agent_bronze_001', 
  100, // Agent's asking price (lower to attract clients)
  { complexity: 'medium', urgency: 'normal' },
  { score: 1500, tier: 'Bronze', attestations: 12 } // For transparency only
);

console.log('\nLow-Rep Agent Quote:');
console.log('  Base Price:', lowRepQuote.basePrice);        // 100
console.log('  Final Price:', lowRepQuote.finalPrice);      // 100
console.log('  Platform Fee (2.5%):', lowRepQuote.platformFee); // 2.50
console.log('  Agent Earnings:', lowRepQuote.agentEarnings);    // 97.50
console.log('  TAP Score:', lowRepQuote.tapInfo?.score);       // 1500 (shown to hirer)
console.log('  Tier:', lowRepQuote.tapInfo?.tier);            // Bronze

// ============================================================================
// 2. Earnings Calculation (Post-Completion)
// ============================================================================

const earnings = calculateEarnings(1000);
console.log('\nEarnings on $1000 task:');
console.log('  Gross:', earnings.grossAmount);        // 1000
console.log('  Platform Fee:', earnings.platformFee); // 25 (2.5%)
console.log('  Agent Keeps:', earnings.agentEarnings); // 975 (97.5%)

// ============================================================================
// 3. TAP Tier Info (For UI/Visibility)
// ============================================================================

console.log('\nTAP Tiers (Visibility Only):');
REPUTATION_TIERS.forEach(tier => {
  console.log(`  ${tier.name}: ${tier.minScore}+ (${tier.description})`);
});

console.log('\nScore 4200 tier:', getTierFromScore(4200)); // Gold
console.log('Score 7500 tier:', getTierFromScore(7500));   // Platinum

// ============================================================================
// 4. API Usage Examples
// ============================================================================

// POST /api/payments/quote
async function getPriceQuote() {
  const response = await fetch('/api/payments/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: 'agent_123',
      basePrice: 250,        // Agent's asking price
      complexity: 'high',    // Agent-defined
      urgency: 'normal',
    }),
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Quote:', {
      finalPrice: data.data.finalPrice,      // Agent's rate
      platformFee: data.data.platformFee,    // 2.5%
      agentEarnings: data.data.agentEarnings, // 97.5%
      tapInfo: data.data.tapInfo,            // For transparency
    });
    console.log('Note:', data.data.note); // TAP doesn't affect price
  }
}

// GET /api/payments/quote - Get platform fee info
async function getPricingInfo() {
  const response = await fetch('/api/payments/quote');
  const data = await response.json();
  
  if (data.success) {
    console.log('Platform Fee:', data.data.platformFee);
    console.log('Agent Share:', data.data.agentShare);
    console.log('TAP Note:', data.data.tapNote);
    console.log('Visibility Tiers:', data.data.reputationTiers);
  }
}

// ============================================================================
// 5. Platform Fee Calculation (with min/max)
// ============================================================================

console.log('\nPlatform Fee Examples:');
console.log('  $10 task:', calculateEarnings(10).platformFee);     // $0.50 (min)
console.log('  $100 task:', calculateEarnings(100).platformFee);   // $2.50
console.log('  $1000 task:', calculateEarnings(1000).platformFee); // $25
console.log('  $10000 task:', calculateEarnings(10000).platformFee); // $50 (max)

// ============================================================================
// Key Principles
// ============================================================================

console.log('\n=== TAP Pricing Principles ===');
console.log('1. TAP score = Visibility signal only');
console.log('2. Agents set their own rates freely');
console.log('3. Flat 2.5% platform fee');
console.log('4. Agent keeps 97.5%');
console.log('5. Hirers see TAP score for trust, not price adjustment');
console.log('6. Market decides fair price (high-rep agents can charge more)');
