/**
 * EigenTrust Reputation Algorithm with Stake Weighting & Time Decay
 * 
 * Based on the paper "EigenTrust: A Reputation Management System
 * for Peer-to-Peer Networks" by Sepandar D. Kamvar et al.
 * 
 * This implementation computes global trust scores using the
 * power iteration method on the trust matrix, with enhancements:
 * - Stake weighting: Higher stakes = more trust weight
 * - Time decay: Older attestations lose weight over time
 * - Logarithmic scaling: Prevents whale dominance
 */

import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

/**
 * Attestation data structure with stake
 */
interface Attestation {
  id: string;
  agent_id: string;
  target_id: string;
  score: number;
  stake_amount: number;
  created_at: string;
  attestation_status?: string;
}

/**
 * Agent data structure
 */
interface Agent {
  claw_id: string;
  name: string;
  tap_score: number;
  total_attestations_received: number;
  total_attestations_given: number;
}

/**
 * WoT Configuration
 */
interface WoTConfig {
  attestation_half_life_days: number;
  max_attestation_age_days: number;
}

/**
 * Trust matrix entry
 */
interface TrustEntry {
  from: string;
  to: string;
  trust: number;
}

/**
 * EigenTrust calculation result
 */
interface EigenTrustResult {
  scores: Map<string, number>;
  iterations: number;
  convergenceDelta: number;
  timestamp: string;
}

/**
 * Configuration for EigenTrust calculation
 */
interface EigenTrustConfig {
  /** Damping factor (alpha) - probability of continuing the random walk */
  alpha: number;
  /** Convergence threshold */
  epsilon: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Minimum attestations for an edge to be considered */
  minAttestations: number;
  /** Time window for attestations (days) - 0 means all time */
  timeWindowDays: number;
  /** Pre-trusted agent IDs (for initial vector) */
  pretrustedAgents: string[];
  /** Half-life for attestation decay (days) */
  halfLifeDays: number;
}

/** Default configuration */
const DEFAULT_CONFIG: EigenTrustConfig = {
  alpha: 0.85,
  epsilon: 1e-6,
  maxIterations: 1000,
  minAttestations: 1,
  timeWindowDays: 0,
  pretrustedAgents: [],
  halfLifeDays: 7, // 7-day half-life for attestations
};

/**
 * Fetch WoT configuration from database
 */
async function fetchWoTConfig(): Promise<WoTConfig> {
  const { data, error } = await getSupabase()
    .from('wot_config')
    .select('attestation_half_life_days, max_attestation_age_days')
    .eq('id', 1)
    .single();
  
  if (error || !data) {
    return {
      attestation_half_life_days: 7,
      max_attestation_age_days: 365,
    };
  }
  
  return data as WoTConfig;
}

/**
 * Calculate time decay factor for an attestation
 * Uses exponential decay: weight = 2^(-age/half_life)
 */
function calculateTimeDecay(createdAt: string, halfLifeDays: number): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay: weight halves every halfLifeDays
  const decay = Math.pow(2, -ageDays / halfLifeDays);
  
  // Clamp to minimum of 0.1 (10% weight for very old attestations)
  return Math.max(0.1, decay);
}

/**
 * Calculate stake multiplier
 * Uses logarithmic scaling to prevent whale dominance
 * log10(stake + 10) / 2 gives:
 * - stake 0 -> 0.5x
 * - stake 100 -> 1.0x
 * - stake 1000 -> 1.5x
 * - stake 10000 -> 2.0x
 */
function calculateStakeMultiplier(stakeAmount: number): number {
  const normalizedStake = Math.max(0, stakeAmount);
  return Math.log10(normalizedStake + 10) / 2;
}

/**
 * Calculate effective weight of an attestation
 * weight = score × stake_multiplier × time_decay
 */
function calculateAttestationWeight(
  att: Attestation,
  halfLifeDays: number,
  maxAgeDays: number
): number {
  // Skip invalid/slashed attestations
  if (att.attestation_status && ['slashed', 'expired'].includes(att.attestation_status)) {
    return 0;
  }
  
  // Check if attestation is too old
  const ageMs = Date.now() - new Date(att.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > maxAgeDays) {
    return 0;
  }
  
  // Base score (0-100 normalized to 0-1)
  const normalizedScore = Math.max(0, Math.min(100, att.score)) / 100;
  
  // Stake multiplier
  const stakeMultiplier = calculateStakeMultiplier(att.stake_amount || 0);
  
  // Time decay
  const timeDecay = calculateTimeDecay(att.created_at, halfLifeDays);
  
  return normalizedScore * stakeMultiplier * timeDecay;
}

/**
 * Fetch attestations from the database
 */
async function fetchAttestations(timeWindowDays: number = 0): Promise<Attestation[]> {
  let query = getSupabase()
    .from('attestations')
    .select('id, agent_id, target_id, score, stake_amount, created_at, attestation_status');

  if (timeWindowDays > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);
    query = query.gte('created_at', cutoffDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch attestations: ${error.message}`);
  }

  return (data as Attestation[]) || [];
}

/**
 * Fetch all agents from the database
 */
async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await getSupabase()
    .from('tap_scores')
    .select('claw_id, name, tap_score, total_attestations_received, total_attestations_given');

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }

  return (data as Agent[]) || [];
}

/**
 * Fetch pre-trusted agents (genesis agents with highest reputation)
 */
async function fetchPretrustedAgents(limit: number = 5): Promise<string[]> {
  // Prioritize genesis agents, then highest reputation
  const { data: genesisAgents, error: genesisError } = await getSupabase()
    .from('agent_registry')
    .select('agent_id')
    .eq('is_genesis', true)
    .eq('activation_status', 'active')
    .limit(limit);
  
  if (!genesisError && genesisAgents && genesisAgents.length > 0) {
    return genesisAgents.map((a: any) => a.agent_id);
  }
  
  // Fallback to highest TAP scores
  const { data, error } = await getSupabase()
    .from('tap_scores')
    .select('claw_id')
    .order('tap_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('Failed to fetch pretrusted agents:', error);
    return [];
  }

  return (data as Array<{ claw_id: string }>)?.map(a => a.claw_id) || [];
}

/**
 * Build the trust matrix from attestations with stake weighting
 * 
 * For each agent pair (i, j), compute:
 * weight[i][j] = sum(attestation_weight) / total_weight_from_i
 * 
 * where attestation_weight = score × stake_multiplier × time_decay
 */
function buildWeightedTrustMatrix(
  attestations: Attestation[],
  agents: Agent[],
  config: EigenTrustConfig,
  wotConfig: WoTConfig
): Map<string, Map<string, number>> {
  const agentIds = new Set(agents.map(a => a.claw_id));
  const trustMatrix = new Map<string, Map<string, number>>();
  
  // Initialize matrix with zeros
  agentIds.forEach(agentId => {
    trustMatrix.set(agentId, new Map());
    agentIds.forEach(targetId => {
      trustMatrix.get(agentId)!.set(targetId, 0);
    });
  });

  // Aggregate weighted scores by agent pair
  const weightedSums = new Map<string, Map<string, number>>();
  
  for (const att of attestations) {
    if (!agentIds.has(att.agent_id) || !agentIds.has(att.target_id)) {
      continue;
    }
    
    // Calculate effective weight
    const weight = calculateAttestationWeight(
      att,
      config.halfLifeDays,
      wotConfig.max_attestation_age_days
    );
    
    if (weight <= 0) continue;
    
    if (!weightedSums.has(att.agent_id)) {
      weightedSums.set(att.agent_id, new Map());
    }
    
    const targetMap = weightedSums.get(att.agent_id)!;
    const currentWeight = targetMap.get(att.target_id) || 0;
    targetMap.set(att.target_id, currentWeight + weight);
  }

  // Normalize to create stochastic matrix
  Array.from(weightedSums.entries()).forEach(([fromAgent, targets]) => {
    let totalWeight = 0;
    
    // Calculate total outgoing weight
    Array.from(targets.values()).forEach(weight => {
      totalWeight += weight;
    });
    
    // Normalize
    if (totalWeight > 0) {
      Array.from(targets.entries()).forEach(([toAgent, weight]) => {
        const normalizedTrust = weight / totalWeight;
        trustMatrix.get(fromAgent)!.set(toAgent, normalizedTrust);
      });
    }
  });

  return trustMatrix;
}

/**
 * Calculate EigenTrust scores using power iteration
 */
async function calculateEigenTrust(
  trustMatrix: Map<string, Map<string, number>>,
  agentIds: string[],
  config: EigenTrustConfig
): Promise<EigenTrustResult> {
  const n = agentIds.length;
  
  if (n === 0) {
    return {
      scores: new Map(),
      iterations: 0,
      convergenceDelta: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Initialize pre-trusted vector
  const pretrustedSet = new Set(config.pretrustedAgents.filter(id => agentIds.includes(id)));
  const p = new Array(n).fill(0);
  
  if (pretrustedSet.size > 0) {
    const uniformWeight = 1 / pretrustedSet.size;
    for (let i = 0; i < n; i++) {
      if (pretrustedSet.has(agentIds[i])) {
        p[i] = uniformWeight;
      }
    }
  } else {
    p.fill(1 / n);
  }

  // Initialize trust vector (uniform)
  let t = new Array(n).fill(1 / n);
  
  // Power iteration
  let iterations = 0;
  let convergenceDelta = Infinity;
  
  while (iterations < config.maxIterations && convergenceDelta > config.epsilon) {
    const tNew = new Array(n).fill(0);
    
    // Multiply by trust matrix: tNew = C * t
    for (let i = 0; i < n; i++) {
      const fromAgent = agentIds[i];
      const row = trustMatrix.get(fromAgent);
      
      if (row) {
        for (let j = 0; j < n; j++) {
          const toAgent = agentIds[j];
          const trustValue = row.get(toAgent) || 0;
          tNew[j] += trustValue * t[i];
        }
      }
    }
    
    // Apply damping: tNew = alpha * C * t + (1 - alpha) * p
    for (let i = 0; i < n; i++) {
      tNew[i] = config.alpha * tNew[i] + (1 - config.alpha) * p[i];
    }
    
    // Calculate convergence (L1 norm of difference)
    convergenceDelta = 0;
    for (let i = 0; i < n; i++) {
      convergenceDelta += Math.abs(tNew[i] - t[i]);
    }
    
    t = tNew;
    iterations++;
  }

  // Convert to Map
  const scores = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    scores.set(agentIds[i], t[i]);
  }

  return {
    scores,
    iterations,
    convergenceDelta,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Normalize scores to 0-10000 range for TAP scores
 * With non-linear scaling to spread out mid-range
 */
function normalizeToTAPScores(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) return scores;

  const values = Array.from(scores.values());
  const maxScore = Math.max(...values);
  const minScore = Math.min(...values);
  
  if (maxScore === minScore) {
    const uniformScore = 5000;
    const result = new Map<string, number>();
    Array.from(scores.entries()).forEach(([agent]) => {
      result.set(agent, uniformScore);
    });
    return result;
  }

  const result = new Map<string, number>();
  Array.from(scores.entries()).forEach(([agent, score]) => {
    // Normalize to 0-1
    const normalized = (score - minScore) / (maxScore - minScore);
    // Apply non-linear scaling (power of 0.7 spreads out high scores)
    const scaled = Math.pow(normalized, 0.7) * 10000;
    result.set(agent, Math.round(scaled));
  });

  return result;
}

/**
 * Determine tier based on TAP score
 */
function getTierFromScore(score: number): string {
  if (score >= 8000) return 'Diamond';
  if (score >= 6000) return 'Platinum';
  if (score >= 4000) return 'Gold';
  if (score >= 2000) return 'Silver';
  return 'Bronze';
}

/**
 * Update TAP scores in the database
 */
async function updateTAPScores(scores: Map<string, number>): Promise<void> {
  const updates: { claw_id: string; tap_score: number; tier: string; last_calculated_at: string; }[] = [];
  
  Array.from(scores.entries()).forEach(([clawId, score]) => {
    updates.push({
      claw_id: clawId,
      tap_score: score,
      tier: getTierFromScore(score),
      last_calculated_at: new Date().toISOString(),
    });
  });

  const { error } = await getSupabase()
    .from('tap_scores')
    .upsert(updates as any, { onConflict: 'claw_id' });

  if (error) {
    throw new Error(`Failed to update TAP scores: ${error.message}`);
  }
}

/**
 * Main EigenTrust calculation function with stake weighting
 */
export async function runEigenTrustCalculation(
  customConfig?: Partial<EigenTrustConfig>
): Promise<EigenTrustResult> {
  console.log('Starting EigenTrust calculation with stake weighting...');
  const startTime = Date.now();

  try {
    // Fetch WoT config for decay parameters
    const wotConfig = await fetchWoTConfig();
    
    // Merge config
    const pretrusted = await fetchPretrustedAgents(5);
    const config: EigenTrustConfig = {
      ...DEFAULT_CONFIG,
      ...customConfig,
      halfLifeDays: wotConfig.attestation_half_life_days,
      pretrustedAgents: customConfig?.pretrustedAgents || pretrusted,
    };

    // Fetch data
    console.log('Fetching attestations and agents...');
    const [attestations, agents] = await Promise.all([
      fetchAttestations(config.timeWindowDays),
      fetchAgents(),
    ]);

    console.log(`Found ${attestations.length} attestations, ${agents.length} agents`);

    if (attestations.length === 0 || agents.length === 0) {
      console.log('Insufficient data for EigenTrust calculation');
      return {
        scores: new Map(),
        iterations: 0,
        convergenceDelta: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Build weighted trust matrix
    console.log('Building weighted trust matrix...');
    const trustMatrix = buildWeightedTrustMatrix(attestations, agents, config, wotConfig);

    // Calculate EigenTrust
    console.log('Running power iteration...');
    const agentIds = agents.map(a => a.claw_id);
    const result = await calculateEigenTrust(trustMatrix, agentIds, config);

    console.log(`Converged after ${result.iterations} iterations (delta: ${result.convergenceDelta.toExponential(2)})`);

    // Normalize and update scores
    console.log('Normalizing and updating scores...');
    const tapScores = normalizeToTAPScores(result.scores);
    await updateTAPScores(tapScores);

    const duration = Date.now() - startTime;
    console.log(`EigenTrust calculation complete in ${duration}ms`);

    return {
      ...result,
      scores: tapScores,
    };

  } catch (error) {
    console.error('EigenTrust calculation failed:', error);
    throw error;
  }
}

/**
 * Get current trust scores for an agent
 */
export async function getAgentTrustScore(clawId: string): Promise<{
  score: number;
  tier: string;
  percentile: number;
} | null> {
  const { data, error } = await getSupabase()
    .from('tap_scores')
    .select('tap_score, tier')
    .eq('claw_id', clawId)
    .single();

  if (error || !data) {
    return null;
  }

  const scoreData = data as { tap_score: number; tier: string };

  const { count } = await getSupabase()
    .from('tap_scores')
    .select('*', { count: 'exact', head: true })
    .lte('tap_score', scoreData.tap_score);

  const { count: total } = await getSupabase()
    .from('tap_scores')
    .select('*', { count: 'exact', head: true });

  const percentile = total && total > 0 
    ? Math.round(((count || 0) / total) * 100)
    : 0;

  return {
    score: scoreData.tap_score,
    tier: scoreData.tier,
    percentile,
  };
}

/**
 * Get weighted trust network for visualization
 */
export async function getTrustNetwork(
  agentId: string,
  depth: number = 2
): Promise<{
  nodes: Array<{ id: string; name: string; score: number }>;
  edges: Array<{ from: string; to: string; weight: number; stake: number; age: number }>;
}> {
  const { data: attestations, error } = await getSupabase()
    .from('attestations')
    .select('agent_id, target_id, score, stake_amount, created_at')
    .or(`agent_id.eq.${agentId},target_id.eq.${agentId}`)
    .limit(100);

  if (error || !attestations) {
    return { nodes: [], edges: [] };
  }

  const typedAttestations = attestations as Array<{
    agent_id: string;
    target_id: string;
    score: number;
    stake_amount: number;
    created_at: string;
  }>;

  const nodeIds = new Set<string>();
  nodeIds.add(agentId);
  typedAttestations.forEach(a => {
    nodeIds.add(a.agent_id);
    nodeIds.add(a.target_id);
  });

  const { data: agents } = await getSupabase()
    .from('tap_scores')
    .select('claw_id, name, tap_score')
    .in('claw_id', Array.from(nodeIds));

  const typedAgents = (agents || []) as Array<{ claw_id: string; name: string | null; tap_score: number }>;

  const nodes = typedAgents.map(a => ({
    id: a.claw_id,
    name: a.name || a.claw_id.slice(0, 8),
    score: a.tap_score,
  }));

  const edges = typedAttestations.map(a => {
    const ageMs = Date.now() - new Date(a.created_at).getTime();
    const ageDays = Math.round(ageMs / (1000 * 60 * 60 * 24));
    
    return {
      from: a.agent_id,
      to: a.target_id,
      weight: a.score / 100,
      stake: a.stake_amount || 0,
      age: ageDays,
    };
  });

  return { nodes, edges };
}

// Export for use in API routes
export {
  DEFAULT_CONFIG,
  fetchAttestations,
  fetchAgents,
  buildWeightedTrustMatrix,
  calculateEigenTrust,
  calculateAttestationWeight,
  calculateTimeDecay,
  calculateStakeMultiplier,
  normalizeToTAPScores,
  updateTAPScores,
};
