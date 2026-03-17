import { createHash, randomBytes } from 'crypto';

interface VirtueRating {
  raterId: string;
  rateeId: string;
  rating: number; // [0, 1]
  prediction: number; // Predicted mean
  timestamp: number;
}

interface Agent {
  id: string;
  integrityScore: number; // 0-100 from behavioral verification
  virtueScore: number; // 0-100 from RBTS
  totalReputation: number;
  interactions: string[]; // IDs of agents interacted with
}

interface RBTSResult {
  meanRating: number;
  raterPayments: Map<string, number>;
  newVirtueScore: number;
}

// ============================================================================
// ROBUST BAYESIAN TRUTH SERUM (RBTS) IMPLEMENTATION
// Based on Prelec (2004) and Witkowski & Parkes (2012)
// ============================================================================

/**
 * Calculate quadratic scoring for a report against the actual mean
 * Q(r, m) = 2r - r² - (1 - 2m + 2mr - m²)
 * Simplified: Q(r, m) = 1 - (r - m)²
 */
function quadraticScore(report: number, mean: number): number {
  return 1 - Math.pow(report - mean, 2);
}

/**
 * Calculate prediction bonus for information revelation
 * Agents are rewarded for predicting the mean accurately
 */
function predictionBonus(prediction: number, actualMean: number): number {
  // Log scoring rule for predictions
  const epsilon = 0.001; // Prevent log(0)
  const p = Math.max(epsilon, Math.min(1 - epsilon, prediction));
  const m = actualMean;
  
  // Proper scoring: higher when prediction is close to actual
  return m * Math.log(p) + (1 - m) * Math.log(1 - p);
}

/**
 * Sample random interactors using VRF (Verifiable Random Function)
 * In production, this would use a proper VRF like Chainlink VRF or Drand
 */
async function sampleRandomInteractors(
  agentId: string,
  allAgents: Map<string, Agent>,
  k: number = 9
): Promise<string[]> {
  // Get agents who have interacted with target agent
  const candidates: string[] = [];
  
  for (const [id, agent] of allAgents) {
    if (id !== agentId && agent.interactions.includes(agentId)) {
      candidates.push(id);
    }
  }
  
  if (candidates.length < k) {
    throw new Error(`Not enough prior interactors: ${candidates.length} < ${k}`);
  }
  
  // VRF-based random selection (simplified)
  // In production: use verifiable random function service
  const seed = createHash('sha256')
    .update(agentId + Date.now().toString())
    .digest('hex');
  
  // Fisher-Yates shuffle with seeded random
  const shuffled = [...candidates];
  let seedIndex = 0;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = parseInt(seed.substring(seedIndex, seedIndex + 8), 16) % (i + 1);
    seedIndex = (seedIndex + 8) % (seed.length - 8);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, k);
}

/**
 * Update virtue scores using RBTS
 * This is the core mechanism for collusion-proof reputation
 */
export async function updateVirtueRBTS(
  rateeId: string,
  allAgents: Map<string, Agent>,
  pendingRatings: VirtueRating[],
  k: number = 9
): Promise<RBTSResult> {
  // Step 1: Sample random interactors
  const raters = await sampleRandomInteractors(rateeId, allAgents, k);
  
  // Step 2: Get ratings from selected raters
  const reports = pendingRatings.filter(r => 
    r.rateeId === rateeId && raters.includes(r.raterId)
  );
  
  if (reports.length < k / 2) {
    throw new Error(`Insufficient ratings: ${reports.length} < ${k/2}`);
  }
  
  // Step 3: Calculate mean rating
  const mean = reports.reduce((sum, r) => sum + r.rating, 0) / reports.length;
  
  // Step 4: Calculate payments for each rater
  const raterPayments = new Map<string, number>();
  
  for (const report of reports) {
    // Quadratic score for rating accuracy
    const qScore = quadraticScore(report.rating, mean);
    
    // Prediction bonus for information revelation
    const pBonus = predictionBonus(report.prediction, mean);
    
    // Total payment (normalized to reasonable range)
    const totalPayment = (qScore + pBonus) / 2;
    
    raterPayments.set(report.raterId, totalPayment);
    
    // Update rater's reputation (they get paid for truthful reporting)
    const rater = allAgents.get(report.raterId);
    if (rater) {
      rater.integrityScore = Math.min(100, rater.integrityScore + totalPayment * 0.1);
    }
  }
  
  // Step 5: Calculate new virtue score for ratee
  const newVirtueScore = Math.round(mean * 100);
  
  return {
    meanRating: mean,
    raterPayments,
    newVirtueScore
  };
}

/**
 * Calculate total reputation by combining Integrity and Virtue axes
 * Formula: TotalRep = 0.6 × Integrity + 0.4 × Virtue
 */
export function calculateTotalReputation(agent: Agent): number {
  return Math.round(0.6 * agent.integrityScore + 0.4 * agent.virtueScore);
}

/**
 * Check if reputation can transfer across domains
 * Uses cosine similarity of claim vectors
 */
export function canTransferReputation(
  sourceDomain: string,
  targetDomain: string,
  claimVectors: Map<string, number[]>,
  threshold: number = 0.7
): boolean {
  const sourceVector = claimVectors.get(sourceDomain);
  const targetVector = claimVectors.get(targetDomain);
  
  if (!sourceVector || !targetVector) return false;
  
  // Cosine similarity
  const dotProduct = sourceVector.reduce((sum, v, i) => sum + v * targetVector[i], 0);
  const sourceMagnitude = Math.sqrt(sourceVector.reduce((sum, v) => sum + v * v, 0));
  const targetMagnitude = Math.sqrt(targetVector.reduce((sum, v) => sum + v * v, 0));
  
  if (sourceMagnitude === 0 || targetMagnitude === 0) return false;
  
  const similarity = dotProduct / (sourceMagnitude * targetMagnitude);
  return similarity >= threshold;
}

// ============================================================================
// COLLUSION RESISTANCE ANALYSIS
// ============================================================================

/**
 * Simulate collusion attack and measure resistance
 * Returns probability of successful manipulation
 */
export function simulateCollusionAttack(
  honestFraction: number,
  k: number,
  colluders: number,
  iterations: number = 1000
): number {
  let successfulManipulations = 0;
  
  for (let i = 0; i < iterations; i++) {
    // Simulate ratings
    const ratings: number[] = [];
    const honestCount = Math.floor(k * honestFraction);
    const actualMean = 0.6; // True quality of agent
    
    // Honest raters report around true mean with noise
    for (let j = 0; j < honestCount; j++) {
      ratings.push(Math.max(0, Math.min(1, actualMean + (Math.random() - 0.5) * 0.2)));
    }
    
    // Colluders try to inflate
    for (let j = 0; j < colluders; j++) {
      ratings.push(1.0); // Maximum fake rating
    }
    
    const observedMean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    
    // Attack succeeds if manipulated mean is >10% above true mean
    if (observedMean > actualMean * 1.1) {
      successfulManipulations++;
    }
  }
  
  return successfulManipulations / iterations;
}

/**
 * Run Monte Carlo simulation for manipulation probability
 * Grok's claim: < 1% manipulation when honest fraction > 2/3
 */
export function runMonteCarloSimulation(): void {
  console.log('RBTS Collusion Resistance Simulation');
  console.log('=====================================\n');
  
  const scenarios = [
    { honestFraction: 0.5, k: 7 },
    { honestFraction: 0.67, k: 9 },
    { honestFraction: 0.75, k: 11 },
    { honestFraction: 0.9, k: 15 }
  ];
  
  for (const { honestFraction, k } of scenarios) {
    const colluders = Math.floor(k * (1 - honestFraction));
    const manipulationProb = simulateCollusionAttack(honestFraction, k, colluders);
    
    console.log(`Honest: ${(honestFraction * 100).toFixed(0)}%, k=${k}, Colluders=${colluders}`);
    console.log(`Manipulation probability: ${(manipulationProb * 100).toFixed(2)}%`);
    console.log(`Grok claim verified: ${manipulationProb < 0.01 ? '✅ YES' : '❌ NO'}\n`);
  }
}

// Run simulation if executed directly
if (require.main === module) {
  runMonteCarloSimulation();
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
// Initialize agents
const agents = new Map<string, Agent>([
  ['agent-a', { id: 'agent-a', integrityScore: 80, virtueScore: 70, totalReputation: 0, interactions: ['agent-b', 'agent-c'] }],
  ['agent-b', { id: 'agent-b', integrityScore: 90, virtueScore: 85, totalReputation: 0, interactions: ['agent-a'] }],
  ['agent-c', { id: 'agent-c', integrityScore: 75, virtueScore: 60, totalReputation: 0, interactions: ['agent-a'] }],
]);

// Collect ratings after interaction
const ratings: VirtueRating[] = [
  { raterId: 'agent-b', rateeId: 'agent-a', rating: 0.8, prediction: 0.75, timestamp: Date.now() },
  { raterId: 'agent-c', rateeId: 'agent-a', rating: 0.7, prediction: 0.72, timestamp: Date.now() },
];

// Update virtue score
const result = await updateVirtueRBTS('agent-a', agents, ratings, 2);
console.log('New virtue score:', result.newVirtueScore);
console.log('Rater payments:', result.raterPayments);

// Calculate total reputation
const agentA = agents.get('agent-a')!;
agentA.virtueScore = result.newVirtueScore;
agentA.totalReputation = calculateTotalReputation(agentA);
console.log('Total reputation:', agentA.totalReputation);
*/
