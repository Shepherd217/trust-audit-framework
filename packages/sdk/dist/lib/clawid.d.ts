/**
 * ClawID - Portable Identity for MoltOS SDK
 *
 * A persistent, portable identity system using Ed25519 keypairs and Merkle-tree history.
 * - Created once, signed by TAP boot hash
 * - Merkle tree records every handoff, task, dispute
 * - Survives restarts, host migrations, framework upgrades
 */
import * as ed from '@noble/ed25519';
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
 * Portable Identity for MoltOS SDK
 *
 * Manages an Ed25519 identity with cryptographically verifiable history
 * using a Merkle tree structure. All significant events are recorded and
 * signed, providing an auditable trail that survives restarts and migrations.
 */
export declare class ClawID {
    private identity;
    private history;
    private merkleRoot;
    /**
     * Private constructor - use create() or import() to instantiate
     */
    private constructor();
    /**
     * Create a new ClawID identity
     *
     * Generates a fresh Ed25519 keypair and creates the initial history entry
     * signed by the provided TAP boot hash.
     *
     * @param bootHash - The TAP boot hash that authorizes this identity creation
     * @returns A new ClawID instance with initialized identity
     */
    static create(bootHash: string): Promise<ClawID>;
    /**
     * Sign data with the identity's private key
     *
     * @param data - Data to sign (string or hex)
     * @returns Hex-encoded Ed25519 signature
     */
    sign(data: string): Promise<string>;
    /**
     * Verify a signature against data
     *
     * @param data - Original data that was signed
     * @param signature - Hex-encoded signature
     * @param publicKey - Optional public key (defaults to this identity's key)
     * @returns True if signature is valid
     */
    verify(data: string, signature: string, publicKey?: string): Promise<boolean>;
    /**
     * Add an event to the identity's history
     *
     * Creates a new history entry, signs it, and updates the Merkle tree.
     *
     * @param type - Type of event
     * @param data - Event-specific data
     * @returns The created history entry
     */
    addToHistory(type: HistoryEntry['type'], data: Record<string, unknown>): Promise<HistoryEntry>;
    /**
     * Update the Merkle root based on current history
     */
    private updateMerkleRoot;
    /**
     * Export the identity to a portable format
     *
     * @returns Portable identity for backup/restore
     */
    export(): PortableIdentity;
    /**
     * Import an identity from a portable format
     *
     * @param portable - Portable identity data
     * @returns ClawID instance with restored identity and history
     */
    static import(portable: PortableIdentity): Promise<ClawID>;
    /**
     * Get the identity ID
     */
    getId(): string;
    /**
     * Get the full identity object
     */
    getIdentity(): Identity;
    /**
     * Get the complete history
     */
    getHistory(): HistoryEntry[];
    /**
     * Get the current Merkle root
     */
    getMerkleRoot(): string;
    /**
     * Get the public key
     */
    getPublicKey(): string;
    /**
     * Generate a Merkle proof for a specific history entry
     *
     * @param index - Index of the history entry
     * @returns Merkle proof for verification
     */
    generateProof(index: number): MerkleProof;
    /**
     * Verify a Merkle proof
     *
     * @param proof - Merkle proof to verify
     * @returns True if proof is valid
     */
    verifyProof(proof: MerkleProof): boolean;
    /**
     * Get the number of history entries
     */
    getHistorySize(): number;
    /**
     * Check if identity is loaded
     */
    isLoaded(): boolean;
    /**
     * Get a specific history entry
     *
     * @param index - History index
     */
    getHistoryEntry(index: number): HistoryEntry;
}
export { ed };
export default ClawID;
//# sourceMappingURL=clawid.d.ts.map