/**
 * EigenTrust Reputation Algorithm
 * 
 * Based on the paper "EigenTrust: A Reputation Management System
 * for Peer-to-Peer Networks" by Sepandar D. Kamvar et al.
 * 
 * This implementation computes global trust scores using the
 * power iteration method on the trust matrix.
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
 * Attestation data structure
 */
interface Attestation {
  id: string;
  agent_id: string;
  target_id: string;
  score: number;
  created_at: string;
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
}

/** Default configuration */
const DEFAULT_CONFIG: EigenTrustConfig = {
  alpha: 0.85,  // Standard PageRank-like damping
  epsilon: 1e-6,  // Convergence threshold
  maxIterations: 1000,
  minAttestations: 1,
  timeWindowDays: 0,  // All time
  pretrustedAgents: [],  // Will be populated from DB
};

/**
 * Fetch attestations from the database
 */
async function fetchAttestations(timeWindowDays: number = 0): Promise<Attestation[]> {
  let query = getSupabase()
    .from('attestations')
    .select('id, agent_id, target_id, score, created_at');

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
 * Build the trust matrix from attestations
 * 
 * For each agent pair (i, j), compute:
   * trust[i][j] = sum of positive scores from i to j / total attestations from i
 * 
 * This normalizes so each agent's outgoing trust sums to 1 (or 0 if no attestations)
 */
function buildTrustMatrix(
  attestations: Attestation[],
  agents: Agent[],
  minAttestations: number = 1
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

  // Aggregate scores by agent pair
  const scoreSums = new Map<string, Map<string, { sum: number; count: number }>>();
  
  for (const att of attestations) {
    if (!agentIds.has(att.agent_id) || !agentIds.has(att.target_id)) {
      continue;  // Skip attestations involving unknown agents
    }
    
    if (!scoreSums.has(att.agent_id)) {
      scoreSums.set(att.agent_id, new Map());
    }
    
    const targetMap = scoreSums.get(att.agent_id)!;
    if (!targetMap.has(att.target_id)) {
      targetMap.set(att.target_id, { sum: 0, count: 0 });
    }
    
    const current = targetMap.get(att.target_id)!;
    current.sum += Math.max(0, att.score);  // Only positive scores contribute to trust
    current.count += 1;
  }

  // Normalize to create stochastic matrix
  Array.from(scoreSums.entries()).forEach(([fromAgent, targets]) => {
    let totalScore = 0;
    
    // Calculate total outgoing score
    Array.from(targets.entries()).forEach(([_, data]) => {
      if (data.count >= minAttestations) {
        totalScore += data.sum;
      }
    });
    
    // Normalize
    if (totalScore > 0) {
      Array.from(targets.entries()).forEach(([toAgent, data]) => {
        if (data.count >= minAttestations) {
          const normalizedTrust = data.sum / totalScore;
          trustMatrix.get(fromAgent)!.set(toAgent, normalizedTrust);
        }
      });
    }
  });

  return trustMatrix;
}

/**
 * Calculate EigenTrust scores using power iteration
 * 
 * The algorithm:
 * 1. Start with initial trust vector (uniform or pre-trusted weighted)
 * 2. Repeatedly multiply by trust matrix: t^(k+1) = alpha * C * t^k + (1-alpha) * p
 * 3. Until convergence
 * 
 * Where:
 * - C is the trust matrix (column-stochastic)
 * - alpha is the damping factor
 * - p is the pre-trusted vector (uniform over pre-trusted agents)
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
    // If no pre-trusted agents, use uniform distribution
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
 */
function normalizeToTAPScores(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) return scores;

  const values = Array.from(scores.values());
  const maxScore = Math.max(...values);
  const minScore = Math.min(...values);
  
  if (maxScore === minScore) {
    // All equal, assign middle score
    const uniformScore = 5000;
    const result = new Map<string, number>();
    Array.from(scores.entries()).forEach(([agent]) => {
      result.set(agent, uniformScore);
    });
    return result;
  }

  const result = new Map<string, number>();
  Array.from(scores.entries()).forEach(([agent, score]) => {
    // Normalize to 0-1, then scale to 0-10000
    const normalized = (score - minScore) / (maxScore - minScore);
    // Apply non-linear scaling to spread out mid-range scores
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

  // Batch update
  const { error } = await getSupabase()
    .from('tap_scores')
    .upsert(updates as any, { onConflict: 'claw_id' });

  if (error) {
    throw new Error(`Failed to update TAP scores: ${error.message}`);
  }
}

/**
 * Main EigenTrust calculation function
 */
export async function runEigenTrustCalculation(
  customConfig?: Partial<EigenTrustConfig>
): Promise<EigenTrustResult> {
  console.log('Starting EigenTrust calculation...');
  const startTime = Date.now();

  try {
    // Merge config
    const pretrusted = await fetchPretrustedAgents(5);
    const config: EigenTrustConfig = {
      ...DEFAULT_CONFIG,
      ...customConfig,
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

    // Build trust matrix
    console.log('Building trust matrix...');
    const trustMatrix = buildTrustMatrix(attestations, agents, config.minAttestations);

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

  // Type assertion for data
  const scoreData = data as { tap_score: number; tier: string };

  // Calculate percentile
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
 * Get trust network for visualization
 */
export async function getTrustNetwork(
  agentId: string,
  depth: number = 2
): Promise<{
  nodes: Array<{ id: string; name: string; score: number }>;
  edges: Array<{ from: string; to: string; weight: number }>;
}> {
  // Get attestations from this agent
  const { data: attestations, error } = await getSupabase()
    .from('attestations')
    .select('agent_id, target_id, score')
    .or(`agent_id.eq.${agentId},target_id.eq.${agentId}`)
    .limit(100);

  if (error || !attestations) {
    return { nodes: [], edges: [] };
  }

  // Type assertion for attestations
  const typedAttestations = attestations as Array<{ agent_id: string; target_id: string; score: number }>;

  const nodeIds = new Set<string>();
  nodeIds.add(agentId);
  typedAttestations.forEach(a => {
    nodeIds.add(a.agent_id);
    nodeIds.add(a.target_id);
  });

  // Get agent details
  const { data: agents } = await getSupabase()
    .from('tap_scores')
    .select('claw_id, name, tap_score')
    .in('claw_id', Array.from(nodeIds));

  // Type assertion for agents
  const typedAgents = (agents || []) as Array<{ claw_id: string; name: string | null; tap_score: number }>;

  const nodes = typedAgents.map(a => ({
    id: a.claw_id,
    name: a.name || a.claw_id.slice(0, 8),
    score: a.tap_score,
  }));

  const edges = typedAttestations.map(a => ({
    from: a.agent_id,
    to: a.target_id,
    weight: a.score / 100,  // Normalize to 0-1
  }));

  return { nodes, edges };
}

// Export for use in API routes
export {
  DEFAULT_CONFIG,
  fetchAttestations,
  fetchAgents,
  buildTrustMatrix,
  calculateEigenTrust,
  normalizeToTAPScores,
  updateTAPScores,
};
