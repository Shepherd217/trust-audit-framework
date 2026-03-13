/**
 * TAP (Trust Attestation Protocol) - EigenTrust-style reputation system
 * 
 * Every action produces a signed attestation.
 * Attestations are weighted by sender's reputation and chained into a Merkle tree.
 * Reputation compounds forever through transitive trust calculations.
 */

import { sign, verify, getPublicKey } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Serialize data for hashing (deterministic)
 */
function serializeForHash(data: unknown): string {
  return JSON.stringify(data, Object.keys(data as object).sort());
}

/**
 * Compute SHA256 hash of data
 */
function computeHash(data: unknown): string {
  const serialized = serializeForHash(data);
  return bytesToHex(sha256(new TextEncoder().encode(serialized)));
}

/**
 * Compute Merkle root from a list of hashes
 */
function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return bytesToHex(sha256(new Uint8Array(0)));
  }
  if (hashes.length === 1) {
    return hashes[0];
  }

  const nextLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = hashes[i + 1] || left; // Duplicate last if odd
    const combined = left + right;
    nextLevel.push(bytesToHex(sha256(new TextEncoder().encode(combined))));
  }

  return computeMerkleRoot(nextLevel);
}

// ============================================================================
// TAPClient Class
// ============================================================================

/**
 * TAP Client for creating and verifying attestations,
 * computing reputation scores, and managing the trust graph.
 */
export class TAPClient {
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;
  private agentId: string;
  private config: Required<TAPConfig>;
  
  // In-memory storage (in production, use persistent storage)
  private attestations: Map<string, Attestation> = new Map();
  private reputationScores: Map<string, ReputationScore> = new Map();
  private trustGraph: TrustGraph;
  private attestationChain: string[] = []; // Ordered list of attestation IDs

  /**
   * Create a new TAP client
   * @param privateKeyHex - Ed25519 private key as hex string
   * @param agentId - Unique identifier for this agent
   * @param config - Optional configuration
   */
  constructor(
    privateKeyHex: string,
    agentId: string,
    config: TAPConfig = {}
  ) {
    this.privateKey = hexToBytes(privateKeyHex);
    this.publicKey = getPublicKey(this.privateKey);
    this.agentId = agentId;
    
    // Default configuration
    this.config = {
      dampingFactor: config.dampingFactor ?? 0.85,
      iterations: config.iterations ?? 100,
      convergenceThreshold: config.convergenceThreshold ?? 1e-10,
      preTrustedAgents: config.preTrustedAgents ?? [],
      preTrustedWeight: config.preTrustedWeight ?? 0.1,
    };

    // Initialize trust graph
    this.trustGraph = {
      agents: new Set([agentId]),
      edges: [],
      adjacency: new Map(),
      reverseAdjacency: new Map(),
      merkleRoot: bytesToHex(sha256(new Uint8Array(0))),
      sequence: 0,
    };

    // Initialize adjacency lists for this agent
    this.trustGraph.adjacency.set(agentId, []);
    this.trustGraph.reverseAdjacency.set(agentId, []);

    // Initialize own reputation
    this.reputationScores.set(agentId, {
      agentId,
      globalScore: this.config.preTrustedAgents.includes(agentId) 
        ? this.config.preTrustedWeight 
        : 0.5, // Neutral starting score
      directTrust: 0,
      transitiveTrust: 0,
      attestationCount: 0,
      givenCount: 0,
      lastUpdated: Date.now(),
    });
  }

  // ============================================================================
  // Core Attestation Methods
  // ============================================================================

  /**
   * Create a signed attestation for an action
   * @param action - The action data to attest (must be JSON-serializable)
   * @param targetAgentId - The agent being attested about (optional, defaults to self)
   * @param options - Additional options for attestation creation
   * @returns The signed attestation
   */
  async attest(
    action: Record<string, unknown>,
    targetAgentId?: string,
    options: AttestationOptions = {}
  ): Promise<Attestation> {
    const timestamp = Date.now();
    const target = targetAgentId || this.agentId;
    
    // Get previous hash for chaining
    const previousHash = options.previousHash ?? 
      (this.attestationChain.length > 0 
        ? computeHash(this.attestations.get(this.attestationChain[this.attestationChain.length - 1]))
        : null);

    // Compute new Merkle root including this attestation
    const allHashes = this.attestationChain.map(id => 
      computeHash(this.attestations.get(id)!)
    );
    
    // Create attestation data (without signature for now)
    const attestationData: Omit<Attestation, 'id' | 'signature' | 'merkleRoot'> = {
      agentId: this.agentId,
      publicKey: bytesToHex(this.publicKey),
      action: {
        ...action,
        ...(options.metadata || {}),
        _targetAgent: target,
      },
      timestamp,
      previousHash,
    };

    // Compute attestation ID
    const id = computeHash(attestationData);
    
    // Compute new Merkle root
    const newMerkleRoot = computeMerkleRoot([...allHashes, id]);

    // Create full attestation with ID and merkle root
    const attestationWithId = {
      ...attestationData,
      id,
      merkleRoot: newMerkleRoot,
      signature: '', // Placeholder
    };

    // Sign the attestation
    const message = new TextEncoder().encode(serializeForHash(attestationWithId));
    const signature = await sign(message, this.privateKey);
    const signatureHex = bytesToHex(signature);

    // Final attestation
    const attestation: Attestation = {
      ...attestationWithId,
      signature: signatureHex,
    };

    // Store attestation
    this.attestations.set(id, attestation);
    this.attestationChain.push(id);

    // Update trust graph
    this.updateTrustGraph(attestation, target);

    // Update Merkle root
    this.trustGraph.merkleRoot = newMerkleRoot;
    this.trustGraph.sequence++;

    // Update reputation (reputation compounds!)
    await this.updateReputation(target);

    return attestation;
  }

  /**
   * Verify an attestation's signature
   * @param attestation - The attestation to verify
   * @returns True if signature is valid
   */
  async verify(attestation: Attestation): Promise<boolean> {
    try {
      // Reconstruct the signed data (without signature)
      const { signature, ...attestationData } = attestation;
      const message = new TextEncoder().encode(serializeForHash(attestationData));
      
      // Verify signature
      const publicKey = hexToBytes(attestation.publicKey);
      const signatureBytes = hexToBytes(signature);
      
      return await verify(signatureBytes, message, publicKey);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Reputation Methods
  // ============================================================================

  /**
   * Get the current reputation score for an agent
   * @param agentId - The agent to get reputation for (defaults to self)
   * @returns The reputation score
   */
  getReputation(agentId?: string): ReputationScore {
    const targetId = agentId || this.agentId;
    
    // Return existing score or create default
    const existing = this.reputationScores.get(targetId);
    if (existing) {
      return { ...existing };
    }

    // Default score for unknown agents
    return {
      agentId: targetId,
      globalScore: 0.5, // Neutral
      directTrust: 0,
      transitiveTrust: 0,
      attestationCount: 0,
      givenCount: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Compute EigenTrust-style transitive trust scores for all agents
   * Uses power iteration to converge on global trust scores
   * @returns Map of agent IDs to their trust scores
   */
  computeTrustScore(): Map<string, number> {
    const agents = Array.from(this.trustGraph.agents);
    const n = agents.length;
    
    if (n === 0) {
      return new Map();
    }

    // Build normalized trust matrix
    const trustMatrix: Map<string, Map<string, number>> = new Map();
    
    for (const agent of agents) {
      const outgoing = this.trustGraph.adjacency.get(agent) || [];
      const totalWeight = outgoing.reduce((sum, e) => sum + e.weight, 0);
      
      const normalizedWeights = new Map<string, number>();
      
      if (totalWeight > 0) {
        for (const edge of outgoing) {
          normalizedWeights.set(edge.to, edge.weight / totalWeight);
        }
      }
      
      // Self-loop if no outgoing edges (prevents dead ends)
      if (normalizedWeights.size === 0) {
        normalizedWeights.set(agent, 1.0);
      }
      
      trustMatrix.set(agent, normalizedWeights);
    }

    // Initialize trust vector with pre-trusted agents or uniform distribution
    let trustVector = new Map<string, number>();
    const preTrusted = this.config.preTrustedAgents.filter(a => agents.includes(a));
    
    if (preTrusted.length > 0) {
      const preTrustedWeight = this.config.preTrustedWeight / preTrusted.length;
      for (const agent of agents) {
        trustVector.set(agent, preTrusted.includes(agent) ? preTrustedWeight : 0);
      }
    } else {
      const uniformWeight = 1.0 / n;
      for (const agent of agents) {
        trustVector.set(agent, uniformWeight);
      }
    }

    // Power iteration
    const dampingFactor = this.config.dampingFactor;
    const teleportProb = preTrusted.length > 0 
      ? (1 - dampingFactor) / preTrusted.length 
      : (1 - dampingFactor) / n;

    for (let iter = 0; iter < this.config.iterations; iter++) {
      const newTrustVector = new Map<string, number>();
      let maxDiff = 0;

      for (const agent of agents) {
        let score = 0;

        // Sum incoming trust
        for (const other of agents) {
          const weights = trustMatrix.get(other)!;
          const weightToThis = weights.get(agent) || 0;
          const otherTrust = trustVector.get(other)!;
          score += dampingFactor * weightToThis * otherTrust;
        }

        // Teleport / pre-trusted jump
        if (preTrusted.length > 0) {
          if (preTrusted.includes(agent)) {
            score += (1 - dampingFactor) / preTrusted.length;
          }
        } else {
          score += (1 - dampingFactor) / n;
        }

        newTrustVector.set(agent, score);
        
        const diff = Math.abs(score - (trustVector.get(agent) || 0));
        maxDiff = Math.max(maxDiff, diff);
      }

      trustVector = newTrustVector;

      // Check convergence
      if (maxDiff < this.config.convergenceThreshold) {
        break;
      }
    }

    // Normalize to ensure scores sum to 1
    const totalTrust = Array.from(trustVector.values()).reduce((a, b) => a + b, 0);
    if (totalTrust > 0) {
      for (const [agent, score] of trustVector) {
        trustVector.set(agent, score / totalTrust);
      }
    }

    return trustVector;
  }

  // ============================================================================
  // Trust Graph Management
  // ============================================================================

  /**
   * Add an external attestation to the trust graph
   * @param attestation - The attestation to add
   * @param targetAgentId - The target agent (if different from action target)
   * @returns True if successfully added
   */
  async addAttestation(
    attestation: Attestation,
    targetAgentId?: string
  ): Promise<boolean> {
    // Verify first
    const isValid = await this.verify(attestation);
    if (!isValid) {
      return false;
    }

    // Check for duplicates
    if (this.attestations.has(attestation.id)) {
      return true; // Already have it
    }

    // Store attestation
    this.attestations.set(attestation.id, attestation);
    this.attestationChain.push(attestation.id);

    // Determine target
    const target = targetAgentId || 
      (attestation.action._targetAgent as string) ||
      attestation.agentId;

    // Update trust graph
    this.updateTrustGraph(attestation, target);

    // Update Merkle root
    const allHashes = this.attestationChain.map(id => 
      computeHash(this.attestations.get(id)!)
    );
    this.trustGraph.merkleRoot = computeMerkleRoot(allHashes);
    this.trustGraph.sequence++;

    // Update reputation
    await this.updateReputation(target);

    return true;
  }

  /**
   * Get the current trust graph
   */
  getTrustGraph(): TrustGraph {
    return {
      agents: new Set(this.trustGraph.agents),
      edges: [...this.trustGraph.edges],
      adjacency: new Map(this.trustGraph.adjacency),
      reverseAdjacency: new Map(this.trustGraph.reverseAdjacency),
      merkleRoot: this.trustGraph.merkleRoot,
      sequence: this.trustGraph.sequence,
    };
  }

  /**
   * Get all attestations for an agent (received)
   * @param agentId - The agent to get attestations for
   */
  getAttestationsForAgent(agentId: string): Attestation[] {
    const incoming = this.trustGraph.reverseAdjacency.get(agentId) || [];
    return incoming
      .map(edge => this.attestations.get(edge.attestationId))
      .filter((a): a is Attestation => a !== undefined);
  }

  /**
   * Get all attestations by an agent (given)
   * @param agentId - The agent who gave attestations
   */
  getAttestationsByAgent(agentId: string): Attestation[] {
    const outgoing = this.trustGraph.adjacency.get(agentId) || [];
    return outgoing
      .map(edge => this.attestations.get(edge.attestationId))
      .filter((a): a is Attestation => a !== undefined);
  }

  /**
   * Get the current Merkle root
   */
  getMerkleRoot(): string {
    return this.trustGraph.merkleRoot;
  }

  /**
   * Get this client's public key
   */
  getPublicKey(): string {
    return bytesToHex(this.publicKey);
  }

  /**
   * Get this client's agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Update the trust graph with a new attestation
   */
  private updateTrustGraph(attestation: Attestation, target: string): void {
    const source = attestation.agentId;
    
    // Add agents to set
    this.trustGraph.agents.add(source);
    this.trustGraph.agents.add(target);

    // Ensure adjacency lists exist
    if (!this.trustGraph.adjacency.has(source)) {
      this.trustGraph.adjacency.set(source, []);
    }
    if (!this.trustGraph.adjacency.has(target)) {
      this.trustGraph.adjacency.set(target, []);
    }
    if (!this.trustGraph.reverseAdjacency.has(source)) {
      this.trustGraph.reverseAdjacency.set(source, []);
    }
    if (!this.trustGraph.reverseAdjacency.has(target)) {
      this.trustGraph.reverseAdjacency.set(target, []);
    }

    // Get source reputation for weighting
    const sourceRep = this.reputationScores.get(source);
    const weight = sourceRep?.globalScore ?? 0.5;

    // Create trust edge
    const edge: TrustEdge = {
      from: source,
      to: target,
      weight,
      timestamp: attestation.timestamp,
      attestationId: attestation.id,
    };

    // Add to edges list
    this.trustGraph.edges.push(edge);

    // Add to adjacency lists
    this.trustGraph.adjacency.get(source)!.push(edge);
    this.trustGraph.reverseAdjacency.get(target)!.push(edge);
  }

  /**
   * Update reputation scores after a new attestation
   * Reputation compounds forever through transitive trust
   */
  private async updateReputation(targetAgentId: string): Promise<void> {
    // Compute global trust scores using EigenTrust
    const globalScores = this.computeTrustScore();

    // Update all agent scores
    for (const agentId of this.trustGraph.agents) {
      const incoming = this.trustGraph.reverseAdjacency.get(agentId) || [];
      const outgoing = this.trustGraph.adjacency.get(agentId) || [];
      
      const directTrust = incoming.reduce((sum, e) => sum + e.weight, 0);
      const globalScore = globalScores.get(agentId) || 0.5;
      
      // Transitive trust is the difference between global and direct
      const transitiveTrust = Math.max(0, globalScore - directTrust / (incoming.length || 1));

      this.reputationScores.set(agentId, {
        agentId,
        globalScore,
        directTrust,
        transitiveTrust,
        attestationCount: incoming.length,
        givenCount: outgoing.length,
        lastUpdated: Date.now(),
      });
    }

    // Ensure target agent has a score even if no attestations yet
    if (!this.reputationScores.has(targetAgentId)) {
      this.reputationScores.set(targetAgentId, {
        agentId: targetAgentId,
        globalScore: globalScores.get(targetAgentId) || 0.5,
        directTrust: 0,
        transitiveTrust: 0,
        attestationCount: 0,
        givenCount: 0,
        lastUpdated: Date.now(),
      });
    }
  }
}

// ============================================================================
// Export additional utilities
// ============================================================================

/**
 * Generate a new Ed25519 keypair for TAP
 * @returns Object with privateKey and publicKey as hex strings
 */
export async function generateKeypair(): Promise<{ privateKey: string; publicKey: string }> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await getPublicKey(privateKey);
  
  return {
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}

/**
 * Utility to verify a batch of attestations
 * @param attestations - Array of attestations to verify
 * @returns Map of attestation IDs to verification results
 */
export async function verifyBatch(
  attestations: Attestation[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  await Promise.all(
    attestations.map(async (att) => {
      const { signature, ...attestationData } = att;
      const message = new TextEncoder().encode(serializeForHash(attestationData));
      
      try {
        const publicKey = hexToBytes(att.publicKey);
        const signatureBytes = hexToBytes(signature);
        const valid = await verify(signatureBytes, message, publicKey);
        results.set(att.id, valid);
      } catch {
        results.set(att.id, false);
      }
    })
  );
  
  return results;
}

// Import ed25519 utils for key generation
import * as ed25519 from '@noble/ed25519';

export default TAPClient;
