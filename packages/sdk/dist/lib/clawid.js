"use strict";
/**
 * ClawID - Portable Identity for MoltOS SDK
 *
 * A persistent, portable identity system using Ed25519 keypairs and Merkle-tree history.
 * - Created once, signed by TAP boot hash
 * - Merkle tree records every handoff, task, dispute
 * - Survives restarts, host migrations, framework upgrades
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
exports.ed = exports.ClawID = void 0;
const ed = __importStar(require("@noble/ed25519"));
exports.ed = ed;
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Hash data using SHA-256
 */
function hashData(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return (0, utils_1.bytesToHex)((0, sha256_1.sha256)(bytes));
}
/**
 * Serialize a history entry for hashing/signing
 */
function serializeEntry(entry) {
    return JSON.stringify({
        type: entry.type,
        timestamp: entry.timestamp,
        data: entry.data,
        previousHash: entry.previousHash,
    });
}
/**
 * Build a Merkle tree from leaf hashes and return the root
 */
function buildMerkleTree(leaves) {
    if (leaves.length === 0) {
        const emptyHash = hashData('');
        return { root: { hash: emptyHash }, leaves: [] };
    }
    // Create leaf nodes
    let currentLevel = leaves.map((hash, index) => ({
        hash,
        leafIndex: index,
    }));
    const leafNodes = [...currentLevel];
    // Build tree level by level
    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left; // Duplicate last node if odd
            const combined = left.hash + right.hash;
            const parentHash = hashData(combined);
            nextLevel.push({
                hash: parentHash,
                left,
                right,
            });
        }
        currentLevel = nextLevel;
    }
    return { root: currentLevel[0], leaves: leafNodes };
}
/**
 * Generate a Merkle proof for a specific leaf index
 */
function generateMerkleProof(leaves, targetIndex) {
    if (leaves.length === 0 || targetIndex < 0 || targetIndex >= leaves.length) {
        throw new Error('Invalid leaf index for Merkle proof');
    }
    const siblings = [];
    let currentLevel = [...leaves];
    let index = targetIndex;
    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left;
            // Add sibling to proof if this pair contains our target
            if (i === index || i + 1 === index) {
                if (index === i) {
                    siblings.push(right);
                }
                else {
                    siblings.push(left);
                }
            }
            const combined = left + right;
            nextLevel.push(hashData(combined));
        }
        index = Math.floor(index / 2);
        currentLevel = nextLevel;
    }
    return {
        leaf: leaves[targetIndex],
        index: targetIndex,
        siblings,
        root: currentLevel[0],
    };
}
/**
 * Verify a Merkle proof
 */
function verifyMerkleProof(proof) {
    let hash = proof.leaf;
    let index = proof.index;
    for (const sibling of proof.siblings) {
        if (index % 2 === 0) {
            // Current node is left child
            hash = hashData(hash + sibling);
        }
        else {
            // Current node is right child
            hash = hashData(sibling + hash);
        }
        index = Math.floor(index / 2);
    }
    return hash === proof.root;
}
// ============================================================================
// ClawID Class
// ============================================================================
/**
 * Portable Identity for MoltOS SDK
 *
 * Manages an Ed25519 identity with cryptographically verifiable history
 * using a Merkle tree structure. All significant events are recorded and
 * signed, providing an auditable trail that survives restarts and migrations.
 */
class ClawID {
    identity = null;
    history = [];
    merkleRoot = '';
    /**
     * Private constructor - use create() or import() to instantiate
     */
    constructor() { }
    /**
     * Create a new ClawID identity
     *
     * Generates a fresh Ed25519 keypair and creates the initial history entry
     * signed by the provided TAP boot hash.
     *
     * @param bootHash - The TAP boot hash that authorizes this identity creation
     * @returns A new ClawID instance with initialized identity
     */
    static async create(bootHash) {
        const claw = new ClawID();
        // Generate Ed25519 keypair
        const privateKeyBytes = ed.utils.randomPrivateKey();
        const publicKeyBytes = await ed.getPublicKey(privateKeyBytes);
        const privateKey = (0, utils_1.bytesToHex)(privateKeyBytes);
        const publicKey = (0, utils_1.bytesToHex)(publicKeyBytes);
        const id = hashData(publicKey).slice(0, 32); // First 32 chars as ID
        // Create identity
        claw.identity = {
            id,
            publicKey,
            privateKey,
            bootHash,
            createdAt: Date.now(),
            version: '1.0.0',
        };
        // Create initial history entry (creation event)
        const creationEntry = {
            type: 'creation',
            timestamp: claw.identity.createdAt,
            data: {
                id,
                publicKey,
                bootHash,
                version: claw.identity.version,
            },
            previousHash: '0'.repeat(64), // Genesis has no previous
        };
        // Sign the creation entry
        const entryData = serializeEntry(creationEntry);
        const signature = await claw.sign(entryData);
        const signedEntry = {
            ...creationEntry,
            signature,
        };
        claw.history.push(signedEntry);
        claw.updateMerkleRoot();
        return claw;
    }
    /**
     * Sign data with the identity's private key
     *
     * @param data - Data to sign (string or hex)
     * @returns Hex-encoded Ed25519 signature
     */
    async sign(data) {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        const privateKeyBytes = (0, utils_1.hexToBytes)(this.identity.privateKey);
        const messageBytes = new TextEncoder().encode(data);
        const signatureBytes = await ed.sign(messageBytes, privateKeyBytes);
        return (0, utils_1.bytesToHex)(signatureBytes);
    }
    /**
     * Verify a signature against data
     *
     * @param data - Original data that was signed
     * @param signature - Hex-encoded signature
     * @param publicKey - Optional public key (defaults to this identity's key)
     * @returns True if signature is valid
     */
    async verify(data, signature, publicKey) {
        const pubKey = publicKey || this.identity?.publicKey;
        if (!pubKey) {
            throw new Error('No public key available for verification');
        }
        try {
            const publicKeyBytes = (0, utils_1.hexToBytes)(pubKey);
            const signatureBytes = (0, utils_1.hexToBytes)(signature);
            const messageBytes = new TextEncoder().encode(data);
            return await ed.verify(signatureBytes, messageBytes, publicKeyBytes);
        }
        catch {
            return false;
        }
    }
    /**
     * Add an event to the identity's history
     *
     * Creates a new history entry, signs it, and updates the Merkle tree.
     *
     * @param type - Type of event
     * @param data - Event-specific data
     * @returns The created history entry
     */
    async addToHistory(type, data) {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        // Get previous hash from last entry
        const previousHash = this.history.length > 0
            ? hashData(serializeEntry(this.history[this.history.length - 1]))
            : '0'.repeat(64);
        const entry = {
            type,
            timestamp: Date.now(),
            data,
            previousHash,
        };
        // Sign the entry
        const entryData = serializeEntry(entry);
        const signature = await this.sign(entryData);
        const signedEntry = {
            ...entry,
            signature,
        };
        this.history.push(signedEntry);
        this.updateMerkleRoot();
        return signedEntry;
    }
    /**
     * Update the Merkle root based on current history
     */
    updateMerkleRoot() {
        if (this.history.length === 0) {
            this.merkleRoot = hashData('');
            return;
        }
        const leaves = this.history.map(entry => hashData(serializeEntry(entry)));
        const { root } = buildMerkleTree(leaves);
        this.merkleRoot = root.hash;
    }
    /**
     * Export the identity to a portable format
     *
     * @returns Portable identity for backup/restore
     */
    export() {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        return {
            identity: this.identity,
            history: [...this.history],
            merkleRoot: this.merkleRoot,
            exportedAt: Date.now(),
            exportVersion: '1.0.0',
        };
    }
    /**
     * Import an identity from a portable format
     *
     * @param portable - Portable identity data
     * @returns ClawID instance with restored identity and history
     */
    static async import(portable) {
        const claw = new ClawID();
        // Validate the portable data
        if (!portable.identity || !portable.history) {
            throw new Error('Invalid portable identity format');
        }
        // Verify history integrity
        const leaves = portable.history.map(entry => hashData(serializeEntry(entry)));
        const { root } = buildMerkleTree(leaves);
        if (root.hash !== portable.merkleRoot) {
            throw new Error('History integrity check failed - Merkle root mismatch');
        }
        // Verify all signatures
        for (const entry of portable.history) {
            const entryData = serializeEntry({
                type: entry.type,
                timestamp: entry.timestamp,
                data: entry.data,
                previousHash: entry.previousHash,
            });
            const valid = await claw.verify(entryData, entry.signature, portable.identity.publicKey);
            if (!valid) {
                throw new Error(`Invalid signature in history entry: ${entry.type}@${entry.timestamp}`);
            }
        }
        claw.identity = portable.identity;
        claw.history = [...portable.history];
        claw.merkleRoot = portable.merkleRoot;
        return claw;
    }
    // ============================================================================
    // Getters
    // ============================================================================
    /**
     * Get the identity ID
     */
    getId() {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        return this.identity.id;
    }
    /**
     * Get the full identity object
     */
    getIdentity() {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        return { ...this.identity };
    }
    /**
     * Get the complete history
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Get the current Merkle root
     */
    getMerkleRoot() {
        return this.merkleRoot;
    }
    /**
     * Get the public key
     */
    getPublicKey() {
        if (!this.identity) {
            throw new Error('No identity loaded');
        }
        return this.identity.publicKey;
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Generate a Merkle proof for a specific history entry
     *
     * @param index - Index of the history entry
     * @returns Merkle proof for verification
     */
    generateProof(index) {
        if (index < 0 || index >= this.history.length) {
            throw new Error('Invalid history index');
        }
        const leaves = this.history.map(entry => hashData(serializeEntry(entry)));
        return generateMerkleProof(leaves, index);
    }
    /**
     * Verify a Merkle proof
     *
     * @param proof - Merkle proof to verify
     * @returns True if proof is valid
     */
    verifyProof(proof) {
        return verifyMerkleProof(proof);
    }
    /**
     * Get the number of history entries
     */
    getHistorySize() {
        return this.history.length;
    }
    /**
     * Check if identity is loaded
     */
    isLoaded() {
        return this.identity !== null;
    }
    /**
     * Get a specific history entry
     *
     * @param index - History index
     */
    getHistoryEntry(index) {
        if (index < 0 || index >= this.history.length) {
            throw new Error('Invalid history index');
        }
        return { ...this.history[index] };
    }
}
exports.ClawID = ClawID;
exports.default = ClawID;
//# sourceMappingURL=clawid.js.map