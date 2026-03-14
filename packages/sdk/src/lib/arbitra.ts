/**
 * Arbitra - Dispute Resolution Module for MoltOS SDK
 * 
 * Architecture:
 * - 5/7 committee voting
 * - Evidence-only voting
 * - 2× reputation slashing for violations
 * - Resolution in <15 minutes
 * - Auto-dispute on ClawLink hash mismatch
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

/** Evidence type for dispute submissions */
export interface Evidence {
  /** Unique identifier for the evidence */
  id: string;
  /** Evidence data (base64 or JSON string) */
  data: string;
  /** SHA-256 hash of the evidence for integrity verification */
  hash: string;
  /** Timestamp when evidence was submitted */
  timestamp: number;
  /** Agent ID who submitted the evidence */
  submitter: string;
  /** Evidence metadata */
  metadata?: Record<string, unknown>;
}

/** Vote cast by a committee member */
export interface Vote {
  /** Vote ID */
  id: string;
  /** Dispute ID this vote belongs to */
  disputeId: string;
  /** Committee member who cast the vote */
  voter: string;
  /** Vote decision: true = in favor, false = against */
  decision: boolean;
  /** Evidence hash this vote is based on */
  evidenceHash: string;
  /** Timestamp of vote */
  timestamp: number;
  /** Digital signature of the vote */
  signature: string;
}

/** Dispute status */
export type DisputeStatus = 'pending' | 'voting' | 'resolved' | 'rejected';

/** Dispute record */
export interface Dispute {
  /** Unique dispute ID */
  id: string;
  /** Dispute title/description */
  description: string;
  /** Agent who filed the dispute */
  plaintiff: string;
  /** Agent being disputed */
  defendant: string;
  /** Current status of the dispute */
  status: DisputeStatus;
  /** Evidence submitted for the dispute */
  evidence: Evidence[];
  /** Committee assigned to the dispute */
  committee: string[];
  /** Votes cast by committee members */
  votes: Vote[];
  /** Dispute creation timestamp */
  createdAt: number;
  /** Dispute resolution timestamp (null if not resolved) */
  resolvedAt: number | null;
  /** Resolution outcome (null if not resolved) */
  resolution: Resolution | null;
  /** ClawLink hash for auto-dispute detection */
  clawLinkHash: string;
  /** Associated transaction or contract ID */
  relatedId?: string;
}

/** Resolution outcome of a dispute */
export interface Resolution {
  /** Resolution ID */
  id: string;
  /** Dispute ID */
  disputeId: string;
  /** Final decision: true = plaintiff wins, false = defendant wins */
  decision: boolean;
  /** Committee members who voted in favor */
  forVotes: string[];
  /** Committee members who voted against */
  againstVotes: string[];
  /** Required votes for majority (5/7) */
  requiredVotes: number;
  /** Timestamp of resolution */
  resolvedAt: number;
  /** Reputation penalties applied */
  penalties: ReputationPenalty[];
}

/** Reputation penalty record */
export interface ReputationPenalty {
  /** Agent ID who received penalty */
  agentId: string;
  /** Amount of reputation slashed (2× for violations) */
  amount: number;
  /** Reason for penalty */
  reason: string;
  /** Timestamp of penalty */
  timestamp: number;
}

/** Agent reputation data */
export interface AgentReputation {
  /** Agent ID */
  agentId: string;
  /** Current reputation score (0-10000) */
  score: number;
  /** Total disputes participated in */
  totalDisputes: number;
  /** Successful dispute resolutions */
  successfulDisputes: number;
  /** Violation count (affects slashing multiplier) */
  violations: number;
  /** Last activity timestamp */
  lastActive: number;
}

/** Configuration for ArbitraClient */
export interface ArbitraConfig {
  /** Base URL for the Arbitra service */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Agent ID of this client */
  agentId: string;
  /** Default committee size (default: 7) */
  committeeSize?: number;
  /** Required majority threshold (default: 5) */
  majorityThreshold?: number;
  /** Resolution timeout in milliseconds (default: 15 minutes) */
  resolutionTimeoutMs?: number;
  /** Reputation slashing multiplier for violations (default: 2) */
  slashMultiplier?: number;
}

/** Result of filing a dispute */
export interface FileDisputeResult {
  /** Created dispute */
  dispute: Dispute;
  /** Assigned committee members */
  committee: string[];
  /** Estimated resolution time */
  estimatedResolutionTime: number;
}

/** Result of casting a vote */
export interface VoteResult {
  /** Cast vote */
  vote: Vote;
  /** Current vote count */
  currentVotes: number;
  /** Required votes for resolution */
  requiredVotes: number;
  /** Whether the dispute is now resolved */
  isResolved: boolean;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

/** Arbitra-specific errors */
export class ArbitraError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ArbitraError';
  }
}

/** Timeout error for resolution */
export class ResolutionTimeoutError extends ArbitraError {
  constructor(disputeId: string) {
    super(
      `Dispute ${disputeId} resolution timeout exceeded`,
      'RESOLUTION_TIMEOUT'
    );
    this.name = 'ResolutionTimeoutError';
  }
}

/** Invalid evidence error */
export class InvalidEvidenceError extends ArbitraError {
  constructor(message: string) {
    super(message, 'INVALID_EVIDENCE');
    this.name = 'InvalidEvidenceError';
  }
}

// ============================================================================
// ARBITRA CLIENT
// ============================================================================

/**
 * ArbitraClient - Dispute Resolution Client for MoltOS SDK
 * 
 * Handles dispute filing, committee voting, resolution calculation,
 * reputation slashing, and automatic disputes on ClawLink hash mismatches.
 */
export class ArbitraClient {
  private config: Required<ArbitraConfig>;
  private disputes: Map<string, Dispute> = new Map();
  private reputations: Map<string, AgentReputation> = new Map();
  private votes: Map<string, Vote> = new Map();
  private hashDisputes: Map<string, string> = new Map(); // clawLinkHash -> disputeId
  private disputeCounter = 0;
  private voteCounter = 0;

  constructor(config: ArbitraConfig) {
    this.config = {
      committeeSize: 7,
      majorityThreshold: 5,
      resolutionTimeoutMs: 15 * 60 * 1000, // 15 minutes
      slashMultiplier: 2,
      ...config,
    };
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * File a new dispute with evidence
   * 
   * @param params - Dispute parameters
   * @returns Filed dispute result with assigned committee
   */
  async fileDispute(params: {
    description: string;
    plaintiff: string;
    defendant: string;
    evidence: Omit<Evidence, 'id' | 'hash' | 'timestamp'>[];
    clawLinkHash: string;
    relatedId?: string;
  }): Promise<FileDisputeResult> {
    // Validate evidence
    if (params.evidence.length === 0) {
      throw new InvalidEvidenceError('At least one evidence item is required');
    }

    // Check for existing dispute on same hash (auto-dispute mechanism)
    const existingDisputeId = this.hashDisputes.get(params.clawLinkHash);
    if (existingDisputeId) {
      const existingDispute = this.disputes.get(existingDisputeId);
      if (existingDispute && existingDispute.status !== 'resolved') {
        throw new ArbitraError(
          `Auto-dispute triggered: ClawLink hash ${params.clawLinkHash} already under dispute (${existingDisputeId})`,
          'HASH_ALREADY_DISPUTED'
        );
      }
    }

    // Generate dispute ID
    const disputeId = this.generateDisputeId();

    // Process and hash evidence
    const processedEvidence: Evidence[] = params.evidence.map((ev, idx) => {
      const dataHash = this.calculateHash(ev.data);
      return {
        id: `${disputeId}-ev-${idx}`,
        data: ev.data,
        hash: dataHash,
        timestamp: Date.now(),
        submitter: ev.submitter,
        metadata: ev.metadata,
      };
    });

    // Select committee (excluding plaintiff and defendant)
    const committee = this.getCommittee(
      this.config.committeeSize,
      [params.plaintiff, params.defendant]
    );

    // Create dispute
    const dispute: Dispute = {
      id: disputeId,
      description: params.description,
      plaintiff: params.plaintiff,
      defendant: params.defendant,
      status: 'voting',
      evidence: processedEvidence,
      committee,
      votes: [],
      createdAt: Date.now(),
      resolvedAt: null,
      resolution: null,
      clawLinkHash: params.clawLinkHash,
      relatedId: params.relatedId,
    };

    // Store dispute
    this.disputes.set(disputeId, dispute);
    this.hashDisputes.set(params.clawLinkHash, disputeId);

    // Set resolution timeout
    this.scheduleResolutionTimeout(disputeId);

    return {
      dispute,
      committee,
      estimatedResolutionTime: this.config.resolutionTimeoutMs,
    };
  }

  /**
   * Cast a vote on a dispute (committee members only)
   * 
   * Implements evidence-only voting - votes must reference specific evidence.
   * 
   * @param params - Vote parameters
   * @returns Vote result with current status
   */
  async vote(params: {
    disputeId: string;
    voter: string;
    decision: boolean;
    evidenceHash: string;
    signature: string;
  }): Promise<VoteResult> {
    const dispute = this.disputes.get(params.disputeId);
    if (!dispute) {
      throw new ArbitraError(
        `Dispute ${params.disputeId} not found`,
        'DISPUTE_NOT_FOUND'
      );
    }

    // Validate dispute status
    if (dispute.status !== 'voting') {
      throw new ArbitraError(
        `Dispute ${params.disputeId} is not open for voting (status: ${dispute.status})`,
        'INVALID_DISPUTE_STATUS'
      );
    }

    // Verify voter is on committee
    if (!dispute.committee.includes(params.voter)) {
      throw new ArbitraError(
        `Agent ${params.voter} is not a committee member for dispute ${params.disputeId}`,
        'NOT_COMMITTEE_MEMBER'
      );
    }

    // Check for duplicate vote
    const existingVote = dispute.votes.find(v => v.voter === params.voter);
    if (existingVote) {
      throw new ArbitraError(
        `Agent ${params.voter} has already voted on dispute ${params.disputeId}`,
        'DUPLICATE_VOTE'
      );
    }

    // Evidence-only voting: verify evidence hash exists
    const evidenceExists = dispute.evidence.some(ev => ev.hash === params.evidenceHash);
    if (!evidenceExists) {
      throw new InvalidEvidenceError(
        `Evidence with hash ${params.evidenceHash} not found in dispute ${params.disputeId}`
      );
    }

    // Create vote
    const vote: Vote = {
      id: this.generateVoteId(),
      disputeId: params.disputeId,
      voter: params.voter,
      decision: params.decision,
      evidenceHash: params.evidenceHash,
      timestamp: Date.now(),
      signature: params.signature,
    };

    // Store vote
    this.votes.set(vote.id, vote);
    dispute.votes.push(vote);

    // Check if we can resolve
    const isResolved = this.canResolve(dispute);
    if (isResolved) {
      await this.resolve(params.disputeId);
    }

    return {
      vote,
      currentVotes: dispute.votes.length,
      requiredVotes: this.config.majorityThreshold,
      isResolved: true,
    };
  }

  /**
   * Resolve a dispute by calculating majority decision
   * 
   * Requires 5/7 committee votes for resolution.
   * 
   * @param disputeId - ID of dispute to resolve
   * @returns Resolution outcome
   */
  async resolve(disputeId: string): Promise<Resolution> {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new ArbitraError(
        `Dispute ${disputeId} not found`,
        'DISPUTE_NOT_FOUND'
      );
    }

    if (dispute.status === 'resolved') {
      if (!dispute.resolution) {
        throw new ArbitraError(
          `Dispute ${disputeId} marked resolved but has no resolution`,
          'INVALID_STATE'
        );
      }
      return dispute.resolution;
    }

    // Count votes
    const forVotes = dispute.votes.filter(v => v.decision).map(v => v.voter);
    const againstVotes = dispute.votes.filter(v => !v.decision).map(v => v.voter);

    // Check for majority (5/7)
    const hasMajorityFor = forVotes.length >= this.config.majorityThreshold;
    const hasMajorityAgainst = againstVotes.length >= this.config.majorityThreshold;

    if (!hasMajorityFor && !hasMajorityAgainst) {
      throw new ArbitraError(
        `Cannot resolve dispute ${disputeId}: insufficient votes (need ${this.config.majorityThreshold}/7)`,
        'INSUFFICIENT_VOTES'
      );
    }

    // Determine decision
    const decision = hasMajorityFor;

    // Apply reputation slashing
    const penalties: ReputationPenalty[] = [];

    if (decision) {
      // Plaintiff wins: defendant loses reputation (2× if violations exist)
      const defendantSlash = this.calculateSlashAmount(dispute.defendant);
      penalties.push(
        await this.slash(dispute.defendant, defendantSlash, 'Lost dispute as defendant')
      );
    } else {
      // Defendant wins: plaintiff loses reputation (2× if violations exist)
      const plaintiffSlash = this.calculateSlashAmount(dispute.plaintiff);
      penalties.push(
        await this.slash(dispute.plaintiff, plaintiffSlash, 'Lost dispute as plaintiff')
      );
    }

    // Slash committee members who didn't vote (inactivity penalty)
    const nonVoters = dispute.committee.filter(
      member => !dispute.votes.some(v => v.voter === member)
    );
    for (const nonVoter of nonVoters) {
      const inactivitySlash = Math.floor(this.calculateSlashAmount(nonVoter) / 2);
      penalties.push(
        await this.slash(nonVoter, inactivitySlash, 'Failed to vote on assigned dispute')
      );
    }

    // Create resolution
    const resolution: Resolution = {
      id: `${disputeId}-res`,
      disputeId,
      decision,
      forVotes,
      againstVotes,
      requiredVotes: this.config.majorityThreshold,
      resolvedAt: Date.now(),
      penalties,
    };

    // Update dispute
    dispute.resolution = resolution;
    dispute.resolvedAt = resolution.resolvedAt;
    dispute.status = 'resolved';

    // Update reputation for winners
    for (const voter of forVotes) {
      this.updateReputation(voter, decision ? 10 : 0, true);
    }
    for (const voter of againstVotes) {
      this.updateReputation(voter, !decision ? 10 : 0, true);
    }

    return resolution;
  }

  /**
   * Apply reputation slashing to an agent
   * 
   * 2× multiplier applies if agent has previous violations.
   * 
   * @param agentId - Agent to slash
   * @param amount - Base amount to slash
   * @param reason - Reason for slashing
   * @returns Applied penalty
   */
  async slash(
    agentId: string,
    amount: number,
    reason: string
  ): Promise<ReputationPenalty> {
    const reputation = this.getOrCreateReputation(agentId);

    // Apply 2× multiplier if agent has violations
    const multiplier = reputation.violations > 0 ? this.config.slashMultiplier : 1;
    const finalAmount = amount * multiplier;

    // Apply penalty
    reputation.score = Math.max(0, reputation.score - finalAmount);
    reputation.violations++;
    reputation.lastActive = Date.now();

    const penalty: ReputationPenalty = {
      agentId,
      amount: finalAmount,
      reason,
      timestamp: Date.now(),
    };

    return penalty;
  }

  /**
   * Get committee of randomly selected high-reputation agents
   * 
   * Selects 7 agents with highest reputation, excluding specified agents.
   * 
   * @param size - Committee size (default: 7)
   * @param exclude - Agents to exclude (e.g., plaintiff/defendant)
   * @returns Array of agent IDs
   */
  getCommittee(size: number = this.config.committeeSize, exclude: string[] = []): string[] {
    // Get all agents sorted by reputation (highest first)
    const allAgents = Array.from(this.reputations.entries())
      .filter(([agentId]) => !exclude.includes(agentId))
      .sort((a, b) => b[1].score - a[1].score);

    // If we don't have enough agents, generate placeholder high-rep agents
    const committee: string[] = [];
    const needed = Math.min(size, allAgents.length + size);

    // Add real high-rep agents first
    for (let i = 0; i < Math.min(size, allAgents.length); i++) {
      committee.push(allAgents[i][0]);
    }

    // Fill remaining slots with weighted random selection
    // Higher rep = higher chance of selection
    while (committee.length < size) {
      const candidates = allAgents.filter(a => !committee.includes(a[0]));
      if (candidates.length === 0) {
        // Generate synthetic committee member
        const syntheticId = `committee-synth-${Date.now()}-${committee.length}`;
        this.reputations.set(syntheticId, {
          agentId: syntheticId,
          score: 8000,
          totalDisputes: 0,
          successfulDisputes: 0,
          violations: 0,
          lastActive: Date.now(),
        });
        committee.push(syntheticId);
      } else {
        // Weighted random selection based on reputation
        const totalWeight = candidates.reduce((sum, [, rep]) => sum + rep.score, 0);
        let random = Math.random() * totalWeight;
        
        for (const [agentId, rep] of candidates) {
          random -= rep.score;
          if (random <= 0) {
            committee.push(agentId);
            break;
          }
        }
      }
    }

    return committee.slice(0, size);
  }

  // ==========================================================================
  // AUTO-DISPUTE METHODS
  // ==========================================================================

  /**
   * Check for ClawLink hash mismatch and auto-file dispute
   * 
   * @param clawLinkHash - Hash to verify
   * @param expectedHash - Expected hash value
   * @param context - Context for the dispute
   * @returns Auto-filed dispute or null if no mismatch
   */
  async checkAndAutoDispute(
    clawLinkHash: string,
    expectedHash: string,
    context: {
      description: string;
      plaintiff: string;
      defendant: string;
      evidence: Omit<Evidence, 'id' | 'hash' | 'timestamp'>[];
      relatedId?: string;
    }
  ): Promise<FileDisputeResult | null> {
    if (clawLinkHash === expectedHash) {
      return null; // No mismatch, no dispute needed
    }

    // Hash mismatch detected - auto-file dispute
    return this.fileDispute({
      ...context,
      clawLinkHash,
    });
  }

  /**
   * Register a ClawLink hash for monitoring
   * 
   * @param hash - Hash to monitor
   * @param disputeId - Associated dispute ID
   */
  registerClawLinkHash(hash: string, disputeId: string): void {
    this.hashDisputes.set(hash, disputeId);
  }

  /**
   * Get dispute ID for a ClawLink hash
   * 
   * @param hash - ClawLink hash
   * @returns Dispute ID or undefined
   */
  getDisputeByHash(hash: string): string | undefined {
    return this.hashDisputes.get(hash);
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /**
   * Get dispute by ID
   */
  getDispute(disputeId: string): Dispute | undefined {
    return this.disputes.get(disputeId);
  }

  /**
   * Get all disputes
   */
  getAllDisputes(): Dispute[] {
    return Array.from(this.disputes.values());
  }

  /**
   * Get disputes by status
   */
  getDisputesByStatus(status: DisputeStatus): Dispute[] {
    return this.getAllDisputes().filter(d => d.status === status);
  }

  /**
   * Get agent reputation
   */
  getReputation(agentId: string): AgentReputation | undefined {
    return this.reputations.get(agentId);
  }

  /**
   * Get vote by ID
   */
  getVote(voteId: string): Vote | undefined {
    return this.votes.get(voteId);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private generateDisputeId(): string {
    this.disputeCounter++;
    return `disp-${Date.now()}-${this.disputeCounter}`;
  }

  private generateVoteId(): string {
    this.voteCounter++;
    return `vote-${Date.now()}-${this.voteCounter}`;
  }

  private calculateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private canResolve(dispute: Dispute): boolean {
    const forCount = dispute.votes.filter(v => v.decision).length;
    const againstCount = dispute.votes.filter(v => !v.decision).length;
    
    return (
      forCount >= this.config.majorityThreshold ||
      againstCount >= this.config.majorityThreshold
    );
  }

  private scheduleResolutionTimeout(disputeId: string): void {
    setTimeout(() => {
      const dispute = this.disputes.get(disputeId);
      if (dispute && dispute.status === 'voting') {
        // Force resolution with available votes
        try {
          this.resolve(disputeId);
        } catch {
          // If can't resolve (insufficient votes), reject the dispute
          dispute.status = 'rejected';
          dispute.resolvedAt = Date.now();
        }
      }
    }, this.config.resolutionTimeoutMs);
  }

  private getOrCreateReputation(agentId: string): AgentReputation {
    let reputation = this.reputations.get(agentId);
    if (!reputation) {
      reputation = {
        agentId,
        score: 5000, // Starting reputation
        totalDisputes: 0,
        successfulDisputes: 0,
        violations: 0,
        lastActive: Date.now(),
      };
      this.reputations.set(agentId, reputation);
    }
    return reputation;
  }

  private calculateSlashAmount(agentId: string): number {
    const reputation = this.getOrCreateReputation(agentId);
    // Base slash is 10% of current score
    return Math.floor(reputation.score * 0.1);
  }

  private updateReputation(
    agentId: string,
    delta: number,
    successful: boolean
  ): void {
    const reputation = this.getOrCreateReputation(agentId);
    reputation.score = Math.min(10000, Math.max(0, reputation.score + delta));
    reputation.totalDisputes++;
    if (successful) {
      reputation.successfulDisputes++;
    }
    reputation.lastActive = Date.now();
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default ArbitraClient;
