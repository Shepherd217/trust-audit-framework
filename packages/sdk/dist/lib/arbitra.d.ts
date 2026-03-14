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
/** Arbitra-specific errors */
export declare class ArbitraError extends Error {
    code: string;
    constructor(message: string, code: string);
}
/** Timeout error for resolution */
export declare class ResolutionTimeoutError extends ArbitraError {
    constructor(disputeId: string);
}
/** Invalid evidence error */
export declare class InvalidEvidenceError extends ArbitraError {
    constructor(message: string);
}
/**
 * ArbitraClient - Dispute Resolution Client for MoltOS SDK
 *
 * Handles dispute filing, committee voting, resolution calculation,
 * reputation slashing, and automatic disputes on ClawLink hash mismatches.
 */
export declare class ArbitraClient {
    private config;
    private disputes;
    private reputations;
    private votes;
    private hashDisputes;
    private disputeCounter;
    private voteCounter;
    constructor(config: ArbitraConfig);
    /**
     * File a new dispute with evidence
     *
     * @param params - Dispute parameters
     * @returns Filed dispute result with assigned committee
     */
    fileDispute(params: {
        description: string;
        plaintiff: string;
        defendant: string;
        evidence: Omit<Evidence, 'id' | 'hash' | 'timestamp'>[];
        clawLinkHash: string;
        relatedId?: string;
    }): Promise<FileDisputeResult>;
    /**
     * Cast a vote on a dispute (committee members only)
     *
     * Implements evidence-only voting - votes must reference specific evidence.
     *
     * @param params - Vote parameters
     * @returns Vote result with current status
     */
    vote(params: {
        disputeId: string;
        voter: string;
        decision: boolean;
        evidenceHash: string;
        signature: string;
    }): Promise<VoteResult>;
    /**
     * Resolve a dispute by calculating majority decision
     *
     * Requires 5/7 committee votes for resolution.
     *
     * @param disputeId - ID of dispute to resolve
     * @returns Resolution outcome
     */
    resolve(disputeId: string): Promise<Resolution>;
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
    slash(agentId: string, amount: number, reason: string): Promise<ReputationPenalty>;
    /**
     * Get committee of randomly selected high-reputation agents
     *
     * Selects 7 agents with highest reputation, excluding specified agents.
     *
     * @param size - Committee size (default: 7)
     * @param exclude - Agents to exclude (e.g., plaintiff/defendant)
     * @returns Array of agent IDs
     */
    getCommittee(size?: number, exclude?: string[]): string[];
    /**
     * Check for ClawLink hash mismatch and auto-file dispute
     *
     * @param clawLinkHash - Hash to verify
     * @param expectedHash - Expected hash value
     * @param context - Context for the dispute
     * @returns Auto-filed dispute or null if no mismatch
     */
    checkAndAutoDispute(clawLinkHash: string, expectedHash: string, context: {
        description: string;
        plaintiff: string;
        defendant: string;
        evidence: Omit<Evidence, 'id' | 'hash' | 'timestamp'>[];
        relatedId?: string;
    }): Promise<FileDisputeResult | null>;
    /**
     * Register a ClawLink hash for monitoring
     *
     * @param hash - Hash to monitor
     * @param disputeId - Associated dispute ID
     */
    registerClawLinkHash(hash: string, disputeId: string): void;
    /**
     * Get dispute ID for a ClawLink hash
     *
     * @param hash - ClawLink hash
     * @returns Dispute ID or undefined
     */
    getDisputeByHash(hash: string): string | undefined;
    /**
     * Get dispute by ID
     */
    getDispute(disputeId: string): Dispute | undefined;
    /**
     * Get all disputes
     */
    getAllDisputes(): Dispute[];
    /**
     * Get disputes by status
     */
    getDisputesByStatus(status: DisputeStatus): Dispute[];
    /**
     * Get agent reputation
     */
    getReputation(agentId: string): AgentReputation | undefined;
    /**
     * Get vote by ID
     */
    getVote(voteId: string): Vote | undefined;
    private generateDisputeId;
    private generateVoteId;
    private calculateHash;
    private canResolve;
    private scheduleResolutionTimeout;
    private getOrCreateReputation;
    private calculateSlashAmount;
    private updateReputation;
}
export default ArbitraClient;
//# sourceMappingURL=arbitra.d.ts.map