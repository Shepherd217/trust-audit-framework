/**
 * ClawFS - Persistent File System for MoltOS SDK
 *
 * A content-addressed, merkle-backed storage system with tiered storage
 * and agent-native permissions. Designed to survive VM crashes and host moves.
 */
/** Content Identifier - SHA-256 hash of file content */
export type CID = string;
/** Storage tier indicating access pattern and persistence level */
export declare enum StorageTier {
    /** Hot: Frequently accessed, memory-cached, local SSD */
    HOT = "hot",
    /** Warm: Occasionally accessed, local disk */
    WARM = "warm",
    /** Cold: Rarely accessed, replicated remote storage */
    COLD = "cold"
}
/** Permission levels for file access */
export declare enum Permission {
    /** Read-only access */
    READ = "read",
    /** Write access (includes read) */
    WRITE = "write",
    /** Admin access (includes read, write, delete, share) */
    ADMIN = "admin"
}
/** Access control entry for an agent */
export interface AccessControl {
    agentId: string;
    permission: Permission;
    grantedAt: Date;
    grantedBy: string;
    expiresAt?: Date;
}
/** Metadata for a stored file */
export interface FileMetadata {
    name: string;
    mimeType: string;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    tags: string[];
    encryptionKeyId?: string;
    compression?: 'gzip' | 'lz4' | 'zstd';
}
/** Complete file entry in ClawFS */
export interface FileEntry {
    cid: CID;
    owner: string;
    metadata: FileMetadata;
    tier: StorageTier;
    accessControl: AccessControl[];
    merkleRoot: string;
    blocks: string[];
    replicationFactor: number;
    lastAccessedAt: Date;
    accessCount: number;
}
/** Merkle tree node for integrity verification */
export interface MerkleNode {
    hash: string;
    left?: MerkleNode;
    right?: MerkleNode;
    cid?: CID;
}
/** Snapshot of the file system state */
export interface Snapshot {
    id: string;
    timestamp: Date;
    merkleRoot: string;
    fileCount: number;
    totalSize: number;
    previousSnapshot?: string;
    includedFiles: CID[];
}
/** Search result with relevance scoring */
export interface SearchResult {
    cid: CID;
    score: number;
    highlights: string[];
    metadata: FileMetadata;
}
/** Configuration for ClawFSClient */
export interface ClawFSConfig {
    agentId: string;
    storagePath: string;
    hotCacheSizeMB: number;
    warmCacheSizeMB: number;
    replicationFactor: number;
    enableEncryption: boolean;
    enableCompression: boolean;
    snapshotIntervalHours: number;
}
/** Storage backend interface for pluggable backends */
export interface StorageBackend {
    get(cid: CID): Promise<Buffer | null>;
    put(cid: CID, data: Buffer, tier: StorageTier): Promise<void>;
    delete(cid: CID): Promise<void>;
    exists(cid: CID): Promise<boolean>;
    promote(cid: CID, toTier: StorageTier): Promise<void>;
    demote(cid: CID, toTier: StorageTier): Promise<void>;
}
export declare class ClawFSError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class FileNotFoundError extends ClawFSError {
    constructor(cid: CID);
}
export declare class PermissionDeniedError extends ClawFSError {
    constructor(agentId: string, cid: CID, required: Permission);
}
export declare class StorageTierError extends ClawFSError {
    constructor(message: string);
}
/** Compute SHA-256 CID for content */
export declare function computeCID(data: Buffer): CID;
/** Compute Merkle tree root from blocks */
export declare function computeMerkleRoot(blocks: string[]): string;
/** Chunk data into blocks for storage */
export declare function chunkData(data: Buffer, blockSize?: number): Buffer[];
declare class MemoryStorageBackend implements StorageBackend {
    private hot;
    private warm;
    private cold;
    private accessStats;
    get(cid: CID): Promise<Buffer | null>;
    put(cid: CID, data: Buffer, tier: StorageTier): Promise<void>;
    delete(cid: CID): Promise<void>;
    exists(cid: CID): Promise<boolean>;
    promote(cid: CID, toTier: StorageTier): Promise<void>;
    demote(cid: CID, toTier: StorageTier): Promise<void>;
    getTier(cid: CID): StorageTier | null;
    getStats(cid: CID): {
        count: number;
        lastAccessed: Date;
    } | undefined;
}
declare class SearchIndex {
    private index;
    private metadata;
    indexFile(cid: CID, metadata: FileMetadata, content?: string): void;
    removeFile(cid: CID): void;
    search(query: string, limit?: number): SearchResult[];
}
export declare class ClawFSClient {
    private agentId;
    private backend;
    private fileIndex;
    private snapshots;
    private searchIndex;
    private config;
    constructor(config: ClawFSConfig, backend?: StorageBackend);
    /**
     * Store a file and return its Content Identifier (CID)
     *
     * @param data - File content as Buffer
     * @param metadata - File metadata
     * @param options - Storage options
     * @returns The CID of the stored file
     */
    write(data: Buffer, metadata?: Partial<FileMetadata>, options?: {
        tier?: StorageTier;
        replicationFactor?: number;
        encrypt?: boolean;
        compress?: boolean;
    }): Promise<CID>;
    /**
     * Retrieve a file by its CID
     *
     * @param cid - Content Identifier
     * @param requesterAgentId - Optional agent ID for permission check (defaults to current agent)
     * @returns File content as Buffer
     */
    read(cid: CID, requesterAgentId?: string): Promise<Buffer>;
    /**
     * Share a file with other agents
     *
     * @param cid - Content Identifier
     * @param agentIds - Array of agent IDs to share with
     * @param permission - Permission level to grant
     * @returns The updated FileEntry
     */
    share(cid: CID, agentIds: string[], permission?: Permission): Promise<FileEntry>;
    /**
     * List files accessible to the current agent
     *
     * @param options - Filter options
     * @returns Array of FileEntry objects
     */
    list(options?: {
        ownedOnly?: boolean;
        tier?: StorageTier;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<FileEntry[]>;
    /**
     * Create a Merkle-backed snapshot of the current file system state
     *
     * @param options - Snapshot options
     * @returns The created Snapshot
     */
    snapshot(options?: {
        includeFiles?: CID[];
        excludeFiles?: CID[];
    }): Promise<Snapshot>;
    /**
     * Semantic search across files
     *
     * @param query - Search query string
     * @param options - Search options
     * @returns Array of SearchResult objects
     */
    search(query: string, options?: {
        limit?: number;
        includeContent?: boolean;
        tags?: string[];
    }): Promise<SearchResult[]>;
    /**
     * Change the storage tier of a file
     *
     * @param cid - Content Identifier
     * @param tier - Target storage tier
     */
    setTier(cid: CID, tier: StorageTier): Promise<void>;
    /**
     * Delete a file (requires ADMIN permission)
     *
     * @param cid - Content Identifier
     */
    delete(cid: CID): Promise<void>;
    /**
     * Get file entry metadata without reading content
     *
     * @param cid - Content Identifier
     * @returns FileEntry if found and accessible
     */
    stat(cid: CID): Promise<FileEntry | null>;
    /**
     * Get all snapshots
     *
     * @returns Array of snapshots
     */
    getSnapshots(): Promise<Snapshot[]>;
    /**
     * Verify file integrity using Merkle tree
     *
     * @param cid - Content Identifier
     * @returns True if file is valid
     */
    verify(cid: CID): Promise<boolean>;
    private inferTier;
    private hasPermission;
    private promoteToTier;
    private generateKeyId;
    /**
     * Export file system state for persistence
     *
     * @returns Serialized state
     */
    exportState(): object;
    /**
     * Import file system state (for recovery after crash)
     *
     * @param state - Serialized state
     */
    importState(state: {
        agentId: string;
        files: [CID, FileEntry][];
        snapshots: Snapshot[];
        config: ClawFSConfig;
    }): void;
}
export default ClawFSClient;
export { MemoryStorageBackend, SearchIndex, };
//# sourceMappingURL=clawfs.d.ts.map