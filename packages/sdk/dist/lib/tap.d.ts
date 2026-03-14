/**
 * TAP (Trust Attestation Protocol) - EigenTrust-style reputation system
 *
 * Every action produces a signed attestation.
 * Attestations are weighted by sender's reputation and chained into a Merkle tree.
 * Reputation compounds forever through transitive trust calculations.
 */
/**
 * Represents a signed attestation of an action
 */
export interface Attestation {
    /** Unique identifier for this attestation */
    id: string;
    /** The agent performing the attestation */
    agentId: string;
    /** The public key of the attesting agent (hex) */
    publicKey: string;
    /** The action being attested (arbitrary JSON-serializable data) */
    action: Record<string, unknown>;
    /** Timestamp of attestation creation (Unix ms) */
    timestamp: number;
    /** Hash of the previous attestation in the chain (for Merkle tree) */
    previousHash: string | null;
    /** Merkle root at the time of attestation */
    merkleRoot: string;
    /** Ed25519 signature (hex) */
    signature: string;
}
/**
 * Reputation score with component breakdown
 */
export interface ReputationScore {
    /** The agent this score belongs to */
    agentId: string;
    /** Global reputation score (0-1 scale) */
    globalScore: number;
    /** Raw cumulative trust from direct attestations */
    directTrust: number;
    /** Transitive trust from the network (EigenTrust) */
    transitiveTrust: number;
    /** Number of attestations received */
    attestationCount: number;
    /** Number of attestations given */
    givenCount: number;
    /** Timestamp of last update */
    lastUpdated: number;
}
/**
 * Edge in the trust graph representing an attestation
 */
export interface TrustEdge {
    /** Source agent (who attested) */
    from: string;
    /** Target agent (who was attested about) */
    to: string;
    /** Weight of the trust (normalized) */
    weight: number;
    /** Timestamp of the attestation */
    timestamp: number;
    /** Attestation ID */
    attestationId: string;
}
/**
 * The complete trust graph for EigenTrust computation
 */
export interface TrustGraph {
    /** All agents in the network */
    agents: Set<string>;
    /** All trust edges (attestations) */
    edges: TrustEdge[];
    /** Adjacency list: agent -> outgoing edges */
    adjacency: Map<string, TrustEdge[]>;
    /** Reverse adjacency: agent -> incoming edges */
    reverseAdjacency: Map<string, TrustEdge[]>;
    /** Merkle root of the current state */
    merkleRoot: string;
    /** Block height / sequence number */
    sequence: number;
}
/**
 * Configuration for TAP client
 */
export interface TAPConfig {
    /** Damping factor for EigenTrust (default: 0.85) */
    dampingFactor?: number;
    /** Number of iterations for power iteration (default: 100) */
    iterations?: number;
    /** Convergence threshold (default: 1e-10) */
    convergenceThreshold?: number;
    /** Pre-trusted agents (seed set for EigenTrust) */
    preTrustedAgents?: string[];
    /** Initial reputation for pre-trusted agents */
    preTrustedWeight?: number;
}
/**
 * Options for creating an attestation
 */
export interface AttestationOptions {
    /** Previous attestation hash for chaining (auto-computed if not provided) */
    previousHash?: string;
    /** Additional metadata to include */
    metadata?: Record<string, unknown>;
}
/**
 * TAP Client for creating and verifying attestations,
 * computing reputation scores, and managing the trust graph.
 */
export declare class TAPClient {
    private privateKey;
    private publicKey;
    private agentId;
    private config;
    private attestations;
    private reputationScores;
    private trustGraph;
    private attestationChain;
    /**
     * Create a new TAP client
     * @param privateKeyHex - Ed25519 private key as hex string
     * @param agentId - Unique identifier for this agent
     * @param config - Optional configuration
     */
    constructor(privateKeyHex: string, agentId: string, config?: TAPConfig);
    /**
     * Create a signed attestation for an action
     * @param action - The action data to attest (must be JSON-serializable)
     * @param targetAgentId - The agent being attested about (optional, defaults to self)
     * @param options - Additional options for attestation creation
     * @returns The signed attestation
     */
    attest(action: Record<string, unknown>, targetAgentId?: string, options?: AttestationOptions): Promise<Attestation>;
    /**
     * Verify an attestation's signature
     * @param attestation - The attestation to verify
     * @returns True if signature is valid
     */
    verify(attestation: Attestation): Promise<boolean>;
    /**
     * Get the current reputation score for an agent
     * @param agentId - The agent to get reputation for (defaults to self)
     * @returns The reputation score
     */
    getReputation(agentId?: string): ReputationScore;
    /**
     * Compute EigenTrust-style transitive trust scores for all agents
     * Uses power iteration to converge on global trust scores
     * @returns Map of agent IDs to their trust scores
     */
    computeTrustScore(): Map<string, number>;
    /**
     * Add an external attestation to the trust graph
     * @param attestation - The attestation to add
     * @param targetAgentId - The target agent (if different from action target)
     * @returns True if successfully added
     */
    addAttestation(attestation: Attestation, targetAgentId?: string): Promise<boolean>;
    /**
     * Get the current trust graph
     */
    getTrustGraph(): TrustGraph;
    /**
     * Get all attestations for an agent (received)
     * @param agentId - The agent to get attestations for
     */
    getAttestationsForAgent(agentId: string): Attestation[];
    /**
     * Get all attestations by an agent (given)
     * @param agentId - The agent who gave attestations
     */
    getAttestationsByAgent(agentId: string): Attestation[];
    /**
     * Get the current Merkle root
     */
    getMerkleRoot(): string;
    /**
     * Get this client's public key
     */
    getPublicKey(): string;
    /**
     * Get this client's agent ID
     */
    getAgentId(): string;
    /**
     * Update the trust graph with a new attestation
     */
    private updateTrustGraph;
    /**
     * Update reputation scores after a new attestation
     * Reputation compounds forever through transitive trust
     */
    private updateReputation;
}
/**
 * Generate a new Ed25519 keypair for TAP
 * @returns Object with privateKey and publicKey as hex strings
 */
export declare function generateKeypair(): Promise<{
    privateKey: string;
    publicKey: string;
}>;
/**
 * Utility to verify a batch of attestations
 * @param attestations - Array of attestations to verify
 * @returns Map of attestation IDs to verification results
 */
export declare function verifyBatch(attestations: Attestation[]): Promise<Map<string, boolean>>;
export default TAPClient;
//# sourceMappingURL=tap.d.ts.map