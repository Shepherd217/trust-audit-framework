"use strict";
/**
 * TAP (Trust Attestation Protocol) - EigenTrust-style reputation system
 *
 * Every action produces a signed attestation.
 * Attestations are weighted by sender's reputation and chained into a Merkle tree.
 * Reputation compounds forever through transitive trust calculations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAPClient = void 0;
exports.generateKeypair = generateKeypair;
exports.verifyBatch = verifyBatch;
const ed25519_1 = require("@noble/ed25519");
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Serialize data for hashing (deterministic)
 */
function serializeForHash(data) {
    return JSON.stringify(data, Object.keys(data).sort());
}
/**
 * Compute SHA256 hash of data
 */
function computeHash(data) {
    const serialized = serializeForHash(data);
    return (0, utils_1.bytesToHex)((0, sha256_1.sha256)(new TextEncoder().encode(serialized)));
}
/**
 * Compute Merkle root from a list of hashes
 */
function computeMerkleRoot(hashes) {
    if (hashes.length === 0) {
        return (0, utils_1.bytesToHex)((0, sha256_1.sha256)(new Uint8Array(0)));
    }
    if (hashes.length === 1) {
        return hashes[0];
    }
    const nextLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
        const left = hashes[i];
        const right = hashes[i + 1] || left; // Duplicate last if odd
        const combined = left + right;
        nextLevel.push((0, utils_1.bytesToHex)((0, sha256_1.sha256)(new TextEncoder().encode(combined))));
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
class TAPClient {
    privateKey;
    publicKey;
    agentId;
    config;
    // In-memory storage (in production, use persistent storage)
    attestations = new Map();
    reputationScores = new Map();
    trustGraph;
    attestationChain = []; // Ordered list of attestation IDs
    /**
     * Create a new TAP client
     * @param privateKeyHex - Ed25519 private key as hex string
     * @param agentId - Unique identifier for this agent
     * @param config - Optional configuration
     */
    constructor(privateKeyHex, agentId, config = {}) {
        this.privateKey = (0, utils_1.hexToBytes)(privateKeyHex);
        this.publicKey = (0, ed25519_1.getPublicKey)(this.privateKey);
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
            merkleRoot: (0, utils_1.bytesToHex)((0, sha256_1.sha256)(new Uint8Array(0))),
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
    async attest(action, targetAgentId, options = {}) {
        const timestamp = Date.now();
        const target = targetAgentId || this.agentId;
        // Get previous hash for chaining
        const previousHash = options.previousHash ??
            (this.attestationChain.length > 0
                ? computeHash(this.attestations.get(this.attestationChain[this.attestationChain.length - 1]))
                : null);
        // Compute new Merkle root including this attestation
        const allHashes = this.attestationChain.map(id => computeHash(this.attestations.get(id)));
        // Create attestation data (without signature for now)
        const attestationData = {
            agentId: this.agentId,
            publicKey: (0, utils_1.bytesToHex)(this.publicKey),
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
        const signature = await (0, ed25519_1.sign)(message, this.privateKey);
        const signatureHex = (0, utils_1.bytesToHex)(signature);
        // Final attestation
        const attestation = {
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
    async verify(attestation) {
        try {
            // Reconstruct the signed data (without signature)
            const { signature, ...attestationData } = attestation;
            const message = new TextEncoder().encode(serializeForHash(attestationData));
            // Verify signature
            const publicKey = (0, utils_1.hexToBytes)(attestation.publicKey);
            const signatureBytes = (0, utils_1.hexToBytes)(signature);
            return await (0, ed25519_1.verify)(signatureBytes, message, publicKey);
        }
        catch {
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
    getReputation(agentId) {
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
    computeTrustScore() {
        const agents = Array.from(this.trustGraph.agents);
        const n = agents.length;
        if (n === 0) {
            return new Map();
        }
        // Build normalized trust matrix
        const trustMatrix = new Map();
        for (const agent of agents) {
            const outgoing = this.trustGraph.adjacency.get(agent) || [];
            const totalWeight = outgoing.reduce((sum, e) => sum + e.weight, 0);
            const normalizedWeights = new Map();
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
        let trustVector = new Map();
        const preTrusted = this.config.preTrustedAgents.filter(a => agents.includes(a));
        if (preTrusted.length > 0) {
            const preTrustedWeight = this.config.preTrustedWeight / preTrusted.length;
            for (const agent of agents) {
                trustVector.set(agent, preTrusted.includes(agent) ? preTrustedWeight : 0);
            }
        }
        else {
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
            const newTrustVector = new Map();
            let maxDiff = 0;
            for (const agent of agents) {
                let score = 0;
                // Sum incoming trust
                for (const other of agents) {
                    const weights = trustMatrix.get(other);
                    const weightToThis = weights.get(agent) || 0;
                    const otherTrust = trustVector.get(other);
                    score += dampingFactor * weightToThis * otherTrust;
                }
                // Teleport / pre-trusted jump
                if (preTrusted.length > 0) {
                    if (preTrusted.includes(agent)) {
                        score += (1 - dampingFactor) / preTrusted.length;
                    }
                }
                else {
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
    async addAttestation(attestation, targetAgentId) {
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
            attestation.action._targetAgent ||
            attestation.agentId;
        // Update trust graph
        this.updateTrustGraph(attestation, target);
        // Update Merkle root
        const allHashes = this.attestationChain.map(id => computeHash(this.attestations.get(id)));
        this.trustGraph.merkleRoot = computeMerkleRoot(allHashes);
        this.trustGraph.sequence++;
        // Update reputation
        await this.updateReputation(target);
        return true;
    }
    /**
     * Get the current trust graph
     */
    getTrustGraph() {
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
    getAttestationsForAgent(agentId) {
        const incoming = this.trustGraph.reverseAdjacency.get(agentId) || [];
        return incoming
            .map(edge => this.attestations.get(edge.attestationId))
            .filter((a) => a !== undefined);
    }
    /**
     * Get all attestations by an agent (given)
     * @param agentId - The agent who gave attestations
     */
    getAttestationsByAgent(agentId) {
        const outgoing = this.trustGraph.adjacency.get(agentId) || [];
        return outgoing
            .map(edge => this.attestations.get(edge.attestationId))
            .filter((a) => a !== undefined);
    }
    /**
     * Get the current Merkle root
     */
    getMerkleRoot() {
        return this.trustGraph.merkleRoot;
    }
    /**
     * Get this client's public key
     */
    getPublicKey() {
        return (0, utils_1.bytesToHex)(this.publicKey);
    }
    /**
     * Get this client's agent ID
     */
    getAgentId() {
        return this.agentId;
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    /**
     * Update the trust graph with a new attestation
     */
    updateTrustGraph(attestation, target) {
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
        const edge = {
            from: source,
            to: target,
            weight,
            timestamp: attestation.timestamp,
            attestationId: attestation.id,
        };
        // Add to edges list
        this.trustGraph.edges.push(edge);
        // Add to adjacency lists
        this.trustGraph.adjacency.get(source).push(edge);
        this.trustGraph.reverseAdjacency.get(target).push(edge);
    }
    /**
     * Update reputation scores after a new attestation
     * Reputation compounds forever through transitive trust
     */
    async updateReputation(targetAgentId) {
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
exports.TAPClient = TAPClient;
// ============================================================================
// Export additional utilities
// ============================================================================
/**
 * Generate a new Ed25519 keypair for TAP
 * @returns Object with privateKey and publicKey as hex strings
 */
async function generateKeypair() {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = await (0, ed25519_1.getPublicKey)(privateKey);
    return {
        privateKey: (0, utils_1.bytesToHex)(privateKey),
        publicKey: (0, utils_1.bytesToHex)(publicKey),
    };
}
/**
 * Utility to verify a batch of attestations
 * @param attestations - Array of attestations to verify
 * @returns Map of attestation IDs to verification results
 */
async function verifyBatch(attestations) {
    const results = new Map();
    await Promise.all(attestations.map(async (att) => {
        const { signature, ...attestationData } = att;
        const message = new TextEncoder().encode(serializeForHash(attestationData));
        try {
            const publicKey = (0, utils_1.hexToBytes)(att.publicKey);
            const signatureBytes = (0, utils_1.hexToBytes)(signature);
            const valid = await (0, ed25519_1.verify)(signatureBytes, message, publicKey);
            results.set(att.id, valid);
        }
        catch {
            results.set(att.id, false);
        }
    }));
    return results;
}
// Import ed25519 utils for key generation
const ed25519 = __importStar(require("@noble/ed25519"));
exports.default = TAPClient;
//# sourceMappingURL=tap.js.map