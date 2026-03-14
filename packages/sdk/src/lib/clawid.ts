/**
 * ClawID - Portable Identity for MoltOS SDK
 * 
 * A persistent, portable identity system using Ed25519 keypairs and Merkle-tree history.
 * - Created once, signed by TAP boot hash
 * - Merkle tree records every handoff, task, dispute
 * - Survives restarts, host migrations, framework upgrades
 */

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Core identity structure containing Ed25519 keys and metadata
 */
export interface Identity {
  /** Unique identifier (derived from public key) */
  id: string;
  /** Ed25519 public key (hex) */
  publicKey: string;
  /** Ed25519 private key (hex, encrypted at rest) */
  privateKey: string;
  /** TAP boot hash that signed this identity's creation */
  bootHash: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Version of the identity format */
  version: string;
}

/**
 * History entry for the Merkle tree - records significant events
 */
export interface HistoryEntry {
  /** Entry type */
  type: 'creation' | 'handoff' | 'task' | 'dispute' | 'migration' | 'upgrade';
  /** Unix timestamp */
  timestamp: number;
  /** Entry-specific data */
  data: Record<string, unknown>;
  /** Hash of the previous entry (for chain integrity) */
  previousHash: string;
  /** Ed25519 signature of this entry by the identity */
  signature: string;
}

/**
 * Merkle proof for verifying history integrity
 */
export interface MerkleProof {
  /** The leaf hash being proven */
  leaf: string;
  /** Index of the leaf in the tree */
  index: number;
  /** Sibling hashes from leaf to root */
  siblings: string[];
  /** Root hash of the Merkle tree */
  root: string;
}

/**
 * Portable export format for backup/restore
 */
export interface PortableIdentity {
  /** The identity itself */
  identity: Identity;
  /** Complete history Merkle tree */
  history: HistoryEntry[];
  /** Current Merkle root */
  merkleRoot: string;
  /** Export timestamp */
  exportedAt: number;
  /** Export format version */
  exportVersion: string;
}

/**
 * Merkle tree node
 */
interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  leafIndex?: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Hash data using SHA-256
 */
function hashData(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return bytesToHex(sha256(bytes));
}

/**
 * Serialize a history entry for hashing/signing
 */
function serializeEntry(entry: Omit<HistoryEntry, 'signature'>): string {
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
function buildMerkleTree(leaves: string[]): { root: MerkleNode; leaves: MerkleNode[] } {
  if (leaves.length === 0) {
    const emptyHash = hashData('');
    return { root: { hash: emptyHash }, leaves: [] };
  }

  // Create leaf nodes
  let currentLevel: MerkleNode[] = leaves.map((hash, index) => ({
    hash,
    leafIndex: index,
  }));

  const leafNodes = [...currentLevel];

  // Build tree level by level
  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];
    
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
function generateMerkleProof(leaves: string[], targetIndex: number): MerkleProof {
  if (leaves.length === 0 || targetIndex < 0 || targetIndex >= leaves.length) {
    throw new Error('Invalid leaf index for Merkle proof');
  }

  const siblings: string[] = [];
  let currentLevel = [...leaves];
  let index = targetIndex;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left;
      
      // Add sibling to proof if this pair contains our target
      if (i === index || i + 1 === index) {
        if (index === i) {
          siblings.push(right);
        } else {
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
function verifyMerkleProof(proof: MerkleProof): boolean {
  let hash = proof.leaf;
  let index = proof.index;

  for (const sibling of proof.siblings) {
    if (index % 2 === 0) {
      // Current node is left child
      hash = hashData(hash + sibling);
    } else {
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
export class ClawID {
  private identity: Identity | null = null;
  private history: HistoryEntry[] = [];
  private merkleRoot: string = '';

  /**
   * Private constructor - use create() or import() to instantiate
   */
  private constructor() {}

  /**
   * Create a new ClawID identity
   * 
   * Generates a fresh Ed25519 keypair and creates the initial history entry
   * signed by the provided TAP boot hash.
   * 
   * @param bootHash - The TAP boot hash that authorizes this identity creation
   * @returns A new ClawID instance with initialized identity
   */
  static async create(bootHash: string): Promise<ClawID> {
    const claw = new ClawID();
    
    // Generate Ed25519 keypair
    const privateKeyBytes = ed.utils.randomPrivateKey();
    const publicKeyBytes = await ed.getPublicKey(privateKeyBytes);
    
    const privateKey = bytesToHex(privateKeyBytes);
    const publicKey = bytesToHex(publicKeyBytes);
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
    const creationEntry: Omit<HistoryEntry, 'signature'> = {
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
    
    const signedEntry: HistoryEntry = {
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
  async sign(data: string): Promise<string> {
    if (!this.identity) {
      throw new Error('No identity loaded');
    }
    
    const privateKeyBytes = hexToBytes(this.identity.privateKey);
    const messageBytes = new TextEncoder().encode(data);
    const signatureBytes = await ed.sign(messageBytes, privateKeyBytes);
    
    return bytesToHex(signatureBytes);
  }

  /**
   * Verify a signature against data
   * 
   * @param data - Original data that was signed
   * @param signature - Hex-encoded signature
   * @param publicKey - Optional public key (defaults to this identity's key)
   * @returns True if signature is valid
   */
  async verify(data: string, signature: string, publicKey?: string): Promise<boolean> {
    const pubKey = publicKey || this.identity?.publicKey;
    if (!pubKey) {
      throw new Error('No public key available for verification');
    }
    
    try {
      const publicKeyBytes = hexToBytes(pubKey);
      const signatureBytes = hexToBytes(signature);
      const messageBytes = new TextEncoder().encode(data);
      
      return await ed.verify(signatureBytes, messageBytes, publicKeyBytes);
    } catch {
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
  async addToHistory(
    type: HistoryEntry['type'],
    data: Record<string, unknown>
  ): Promise<HistoryEntry> {
    if (!this.identity) {
      throw new Error('No identity loaded');
    }
    
    // Get previous hash from last entry
    const previousHash = this.history.length > 0
      ? hashData(serializeEntry(this.history[this.history.length - 1]))
      : '0'.repeat(64);
    
    const entry: Omit<HistoryEntry, 'signature'> = {
      type,
      timestamp: Date.now(),
      data,
      previousHash,
    };
    
    // Sign the entry
    const entryData = serializeEntry(entry);
    const signature = await this.sign(entryData);
    
    const signedEntry: HistoryEntry = {
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
  private updateMerkleRoot(): void {
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
  export(): PortableIdentity {
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
  static async import(portable: PortableIdentity): Promise<ClawID> {
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
  getId(): string {
    if (!this.identity) {
      throw new Error('No identity loaded');
    }
    return this.identity.id;
  }

  /**
   * Get the full identity object
   */
  getIdentity(): Identity {
    if (!this.identity) {
      throw new Error('No identity loaded');
    }
    return { ...this.identity };
  }

  /**
   * Get the complete history
   */
  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get the current Merkle root
   */
  getMerkleRoot(): string {
    return this.merkleRoot;
  }

  /**
   * Get the public key
   */
  getPublicKey(): string {
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
  generateProof(index: number): MerkleProof {
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
  verifyProof(proof: MerkleProof): boolean {
    return verifyMerkleProof(proof);
  }

  /**
   * Get the number of history entries
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Check if identity is loaded
   */
  isLoaded(): boolean {
    return this.identity !== null;
  }

  /**
   * Get a specific history entry
   * 
   * @param index - History index
   */
  getHistoryEntry(index: number): HistoryEntry {
    if (index < 0 || index >= this.history.length) {
      throw new Error('Invalid history index');
    }
    return { ...this.history[index] };
  }
}

// ============================================================================
// Export Types
// ============================================================================

export { ed };
export default ClawID;
