/**
 * ============================================================================
 * TAP (Trust & Authority Protocol) - Reputation Service
 * ============================================================================
 * 
 * Integrates with existing tap-dashboard infrastructure:
 * - Extends lib/payments/pricing.ts reputation system
 * - Connects to lib/payments/escrow.ts dispute resolution
 * - Uses lib/claw/bus.ts for real-time updates
 * 
 * TAP Score: 0-10000 (maps to dashboard 0-100)
 * - Earned through work, disputes, committee participation
 * - Non-transferable, slashable for bad behavior
 * 
 * @module lib/claw/tap
 * @version 1.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ReputationTier } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TAPScore {
  clawId: string;
  tapScore: number;           // 0-10000
  dashboardScore: number;     // 0-100 (mapped)
  tier: ReputationTier;
  
  // Work metrics
  jobsCompleted: number;
  jobsFailed: number;
  totalEarnings: number;      // in cents
  
  // Dispute metrics
  disputesAsWorker: number;
  disputesAsHirer: number;
  disputesWon: number;
  disputesLost: number;
  
  // Committee metrics
  committeeParticipations: number;
  committeeVotesCast: number;
  committeeAccuracy: number;  // 0-1 (correct votes / total votes)
  
  // Slashing history
  slashCount: number;
  lastSlashAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface TAPReputationEvent {
  id: string;
  clawId: string;
  eventType: 'job_completed' | 'job_failed' | 'dispute_won' | 'dispute_lost' | 
             'committee_vote' | 'committee_correct' | 'committee_incorrect' | 'slash';
  tapDelta: number;          // Can be negative
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CommitteeSelectionParams {
  disputeId: string;
  size?: number;             // Default 7
  minTapScore?: number;      // Default 4000 (Silver)
  excludeClawIds?: string[]; // Exclude parties to dispute
}

export interface CommitteeMember {
  clawId: string;
  name: string;
  tapScore: number;
  tier: ReputationTier;
  committeeParticipations: number;
  committeeAccuracy: number;
  selectedAt: Date;
}

// ============================================================================
// SCORE CONFIGURATION
// ============================================================================

const TAP_CONFIG = {
  // Score ranges (0-10000)
  tiers: [
    { name: 'Novice' as ReputationTier, min: 0, max: 2000, multiplier: 1.0 },
    { name: 'Bronze' as ReputationTier, min: 2001, max: 4000, multiplier: 1.1 },
    { name: 'Silver' as ReputationTier, min: 4001, max: 6000, multiplier: 1.2 },
    { name: 'Gold' as ReputationTier, min: 6001, max: 7500, multiplier: 1.3 },
    { name: 'Platinum' as ReputationTier, min: 7501, max: 9000, multiplier: 1.4 },
    { name: 'Diamond' as ReputationTier, min: 9001, max: 10000, multiplier: 1.5 },
  ],
  
  // Score deltas
  deltas: {
    job_completed: 50,
    job_failed: -100,
    dispute_won: 100,
    dispute_lost: -200,
    committee_vote: 5,
    committee_correct: 10,
    committee_incorrect: -20,
    slash: 0, // Handled separately by severity
  } as Record<string, number>,
  
  // Committee selection
  committee: {
    defaultSize: 7,
    minTapScore: 4000,      // Silver tier minimum
    majorityThreshold: 4,   // 4 of 7
    votingWindowMinutes: 15,
  },
};

// ============================================================================
// TAP SERVICE
// ============================================================================

export class TAPService {
  constructor(private supabase: SupabaseClient) {}

  // ==========================================================================
  // SCORE CALCULATION & MAPPING
  // ==========================================================================

  /**
   * Map TAP score (0-10000) to dashboard score (0-100)
   */
  static tapToDashboard(tapScore: number): number {
    return Math.min(100, Math.max(0, Math.floor(tapScore / 100)));
  }

  /**
   * Map dashboard score (0-100) to TAP score (0-10000)
   */
  static dashboardToTap(dashboardScore: number): number {
    return Math.min(10000, Math.max(0, dashboardScore * 100));
  }

  /**
   * Get tier from TAP score
   */
  static getTier(tapScore: number): ReputationTier {
    const tier = TAP_CONFIG.tiers.find(t => tapScore >= t.min && tapScore <= t.max);
    return tier?.name || 'Novice';
  }

  /**
   * Get tier multiplier for pricing
   */
  static getTierMultiplier(tapScore: number): number {
    const tier = TAP_CONFIG.tiers.find(t => tapScore >= t.min && tapScore <= t.max);
    return tier?.multiplier || 1.0;
  }

  // ==========================================================================
  // AGENT REPUTATION
  // ==========================================================================

  /**
   * Get or create TAP score for agent
   */
  async getAgentTAP(clawId: string): Promise<TAPScore> {
    const { data, error } = await this.supabase
      .from('tap_scores')
      .select('*')
      .eq('claw_id', clawId)
      .single();

    if (error?.code === 'PGRST116') {
      // Not found, create new
      return this.createAgentTAP(clawId);
    }

    if (error) {
      throw new Error(`Failed to get TAP score: ${error.message}`);
    }

    return this.mapTAPFromDB(data);
  }

  /**
   * Create new TAP score record
   */
  async createAgentTAP(clawId: string, initialScore: number = 1000): Promise<TAPScore> {
    const { data, error } = await this.supabase
      .from('tap_scores')
      .insert({
        claw_id: clawId,
        tap_score: initialScore,
        dashboard_score: TAPService.tapToDashboard(initialScore),
        tier: TAPService.getTier(initialScore),
        jobs_completed: 0,
        jobs_failed: 0,
        total_earnings: 0,
        disputes_as_worker: 0,
        disputes_as_hirer: 0,
        disputes_won: 0,
        disputes_lost: 0,
        committee_participations: 0,
        committee_votes_cast: 0,
        committee_accuracy: 0,
        slash_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create TAP score: ${error.message}`);
    }

    return this.mapTAPFromDB(data);
  }

  /**
   * Update TAP score with event
   */
  async recordEvent(
    clawId: string,
    eventType: TAPReputationEvent['eventType'],
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<TAPScore> {
    const delta = TAP_CONFIG.deltas[eventType] || 0;
    
    // Get current score
    const current = await this.getAgentTAP(clawId);
    
    // Calculate new score (clamp 0-10000)
    const newTapScore = Math.min(10000, Math.max(0, current.tapScore + delta));
    
    // Update record
    const updates: Record<string, any> = {
      tap_score: newTapScore,
      dashboard_score: TAPService.tapToDashboard(newTapScore),
      tier: TAPService.getTier(newTapScore),
      updated_at: new Date().toISOString(),
    };

    // Update counters based on event type
    switch (eventType) {
      case 'job_completed':
        updates.jobs_completed = current.jobsCompleted + 1;
        break;
      case 'job_failed':
        updates.jobs_failed = current.jobsFailed + 1;
        break;
      case 'dispute_won':
        updates.disputes_won = current.disputesWon + 1;
        break;
      case 'dispute_lost':
        updates.disputes_lost = current.disputesLost + 1;
        updates.slash_count = current.slashCount + 1;
        updates.last_slash_at = new Date().toISOString();
        break;
      case 'committee_vote':
        updates.committee_votes_cast = current.committeeVotesCast + 1;
        break;
      case 'committee_correct':
        updates.committee_accuracy = this.calculateNewAccuracy(current, true);
        break;
      case 'committee_incorrect':
        updates.committee_accuracy = this.calculateNewAccuracy(current, false);
        break;
    }

    const { data, error } = await this.supabase
      .from('tap_scores')
      .update(updates)
      .eq('claw_id', clawId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update TAP score: ${error.message}`);
    }

    // Record the event
    await this.recordEventLog(clawId, eventType, delta, description, metadata);

    return this.mapTAPFromDB(data);
  }

  /**
   * Record event to audit log
   */
  private async recordEventLog(
    clawId: string,
    eventType: TAPReputationEvent['eventType'],
    tapDelta: number,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.supabase
      .from('tap_events')
      .insert({
        claw_id: clawId,
        event_type: eventType,
        tap_delta: tapDelta,
        description,
        metadata: metadata ?? {},
      });
  }

  /**
   * Calculate new committee accuracy
   */
  private calculateNewAccuracy(current: TAPScore, wasCorrect: boolean): number {
    const totalVotes = current.committeeVotesCast + 1;
    const correctVotes = Math.round(current.committeeAccuracy * current.committeeVotesCast) + (wasCorrect ? 1 : 0);
    return correctVotes / totalVotes;
  }

  // ==========================================================================
  // COMMITTEE SELECTION
  // ==========================================================================

  /**
   * Select committee for dispute using weighted random selection
   * Higher TAP = higher probability of selection
   */
  async selectCommittee(params: CommitteeSelectionParams): Promise<CommitteeMember[]> {
    const {
      disputeId,
      size = TAP_CONFIG.committee.defaultSize,
      minTapScore = TAP_CONFIG.committee.minTapScore,
      excludeClawIds = [],
    } = params;

    // Get eligible agents
    const { data: eligible, error } = await this.supabase
      .from('tap_scores')
      .select('*')
      .gte('tap_score', minTapScore)
      .not('claw_id', 'in', `(${excludeClawIds.join(',')})`)
      .order('tap_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch eligible agents: ${error.message}`);
    }

    if (!eligible || eligible.length < size) {
      throw new Error(`Not enough eligible agents. Need ${size}, found ${eligible?.length || 0}`);
    }

    // Weighted random selection
    const selected = this.weightedRandomSelect(eligible, size);

    // Record committee assignment
    const committeeMembers: CommitteeMember[] = selected.map(agent => ({
      clawId: agent.claw_id,
      name: agent.name || agent.claw_id,
      tapScore: agent.tap_score,
      tier: agent.tier,
      committeeParticipations: agent.committee_participations,
      committeeAccuracy: agent.committee_accuracy,
      selectedAt: new Date(),
    }));

    // Update committee participation count
    for (const member of selected) {
      await this.supabase
        .from('tap_scores')
        .update({
          committee_participations: member.committee_participations + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('claw_id', member.claw_id);
    }

    // Store committee assignment
    await this.supabase
      .from('dispute_committees')
      .insert({
        dispute_id: disputeId,
        members: committeeMembers.map(m => m.clawId),
        selected_at: new Date().toISOString(),
        voting_ends_at: new Date(Date.now() + TAP_CONFIG.committee.votingWindowMinutes * 60 * 1000).toISOString(),
      });

    return committeeMembers;
  }

  /**
   * Weighted random selection
   * Probability = agent's TAP score / sum of all TAP scores
   */
  private weightedRandomSelect(agents: any[], count: number): any[] {
    const selected: any[] = [];
    const pool = [...agents];
    
    while (selected.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, a) => sum + a.tap_score, 0);
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < pool.length; i++) {
        random -= pool[i].tap_score;
        if (random <= 0) {
          selected.push(pool[i]);
          pool.splice(i, 1);
          break;
        }
      }
    }
    
    return selected;
  }

  // ==========================================================================
  // LEADERBOARD
  // ==========================================================================

  /**
   * Get top agents by TAP score
   */
  async getLeaderboard(limit: number = 100): Promise<TAPScore[]> {
    const { data, error } = await this.supabase
      .from('tap_scores')
      .select('*')
      .order('tap_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    }

    return (data || []).map(this.mapTAPFromDB);
  }

  /**
   * Get agents eligible for committee duty
   */
  async getEligibleCommitteeMembers(minTapScore: number = 4000): Promise<TAPScore[]> {
    const { data, error } = await this.supabase
      .from('tap_scores')
      .select('*')
      .gte('tap_score', minTapScore)
      .order('tap_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch eligible members: ${error.message}`);
    }

    return (data || []).map(this.mapTAPFromDB);
  }

  // ==========================================================================
  // ENHANCED PRICING
  // ==========================================================================

  /**
   * Calculate enhanced reputation score combining:
   * - Traditional metrics (60%): completion, accuracy, response time
   * - TAP data (40%): score, disputes, committee participation
   */
  calculateEnhancedReputation(
    traditionalScore: number,  // 0-100 from pricing.ts
    tapScore: TAPScore
  ): { score: number; tier: ReputationTier; multiplier: number } {
    // Normalize TAP to 0-100
    const tapNormalized = TAPService.tapToDashboard(tapScore.tapScore);
    
    // Weight: 60% traditional, 40% TAP
    const combined = Math.round(traditionalScore * 0.6 + tapNormalized * 0.4);
    
    // Apply dispute penalties
    let adjusted = combined;
    if (tapScore.disputesLost > 0) {
      adjusted -= tapScore.disputesLost * 5; // -5 per lost dispute
    }
    if (tapScore.slashCount > 0) {
      adjusted -= tapScore.slashCount * 2; // -2 per slash
    }
    
    // Clamp 0-100
    adjusted = Math.min(100, Math.max(0, adjusted));
    
    // Map back to TAP for tier/multiplier
    const tapEquivalent = TAPService.dashboardToTap(adjusted);
    
    return {
      score: adjusted,
      tier: TAPService.getTier(tapEquivalent),
      multiplier: TAPService.getTierMultiplier(tapEquivalent),
    };
  }

  // ==========================================================================
  // DATABASE MAPPERS
  // ==========================================================================

  private mapTAPFromDB(data: any): TAPScore {
    return {
      clawId: data.claw_id,
      tapScore: data.tap_score,
      dashboardScore: data.dashboard_score,
      tier: data.tier,
      jobsCompleted: data.jobs_completed,
      jobsFailed: data.jobs_failed,
      totalEarnings: data.total_earnings,
      disputesAsWorker: data.disputes_as_worker,
      disputesAsHirer: data.disputes_as_hirer,
      disputesWon: data.disputes_won,
      disputesLost: data.disputes_lost,
      committeeParticipations: data.committee_participations,
      committeeVotesCast: data.committee_votes_cast,
      committeeAccuracy: data.committee_accuracy,
      slashCount: data.slash_count,
      lastSlashAt: data.last_slash_at ? new Date(data.last_slash_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let tapService: TAPService | null = null;

export function getTAPService(supabase: SupabaseClient): TAPService {
  if (!tapService) {
    tapService = new TAPService(supabase);
  }
  return tapService;
}

export { TAP_CONFIG };
export default TAPService;