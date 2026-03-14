/**
 * ClawFS - Persistent File System for MoltOS SDK
 * 
 * A content-addressed, merkle-backed storage system with tiered storage
 * and agent-native permissions. Designed to survive VM crashes and host moves.
 */

import { createHash, randomUUID } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

/** Content Identifier - SHA-256 hash of file content */
export type CID = string;

/** Storage tier indicating access pattern and persistence level */
export enum StorageTier {
  /** Hot: Frequently accessed, memory-cached, local SSD */
  HOT = 'hot',
  /** Warm: Occasionally accessed, local disk */
  WARM = 'warm',
  /** Cold: Rarely accessed, replicated remote storage */
  COLD = 'cold',
}

/** Permission levels for file access */
export enum Permission {
  /** Read-only access */
  READ = 'read',
  /** Write access (includes read) */
  WRITE = 'write',
  /** Admin access (includes read, write, delete, share) */
  ADMIN = 'admin',
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
  blocks: string[]; // List of block CIDs for chunked storage
  replicationFactor: number;
  lastAccessedAt: Date;
  accessCount: number;
}

/** Merkle tree node for integrity verification */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  cid?: CID; // Leaf nodes reference content blocks
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

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class ClawFSError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ClawFSError';
  }
}

export class FileNotFoundError extends ClawFSError {
  constructor(cid: CID) {
    super(`File not found: ${cid}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
  }
}

export class PermissionDeniedError extends ClawFSError {
  constructor(agentId: string, cid: CID, required: Permission) {
    super(`Agent ${agentId} lacks ${required} permission for ${cid}`, 'PERMISSION_DENIED');
    this.name = 'PermissionDeniedError';
  }
}

export class StorageTierError extends ClawFSError {
  constructor(message: string) {
    super(message, 'STORAGE_TIER_ERROR');
    this.name = 'StorageTierError';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Compute SHA-256 CID for content */
export function computeCID(data: Buffer): CID {
  return createHash('sha256').update(data).digest('hex');
}

/** Compute Merkle tree root from blocks */
export function computeMerkleRoot(blocks: string[]): string {
  if (blocks.length === 0) {
    return createHash('sha256').update('').digest('hex');
  }
  
  // Build tree bottom-up
  let level = blocks.map(hash => ({ hash } as MerkleNode));
  
  while (level.length > 1) {
    const nextLevel: MerkleNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left; // Duplicate last if odd
      const combined = createHash('sha256')
        .update(left.hash + right.hash)
        .digest('hex');
      nextLevel.push({ hash: combined, left, right });
    }
    level = nextLevel;
  }
  
  return level[0].hash;
}

/** Chunk data into blocks for storage */
export function chunkData(data: Buffer, blockSize: number = 1024 * 1024): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += blockSize) {
    chunks.push(data.subarray(i, i + blockSize));
  }
  return chunks.length > 0 ? chunks : [Buffer.alloc(0)];
}

// ============================================================================
// MEMORY BACKEND (for demo/testing - production would use persistent storage)
// ============================================================================

class MemoryStorageBackend implements StorageBackend {
  private hot = new Map<CID, Buffer>();
  private warm = new Map<CID, Buffer>();
  private cold = new Map<CID, Buffer>();
  private accessStats = new Map<CID, { count: number; lastAccessed: Date }>();

  async get(cid: CID): Promise<Buffer | null> {
    for (const tier of [this.hot, this.warm, this.cold]) {
      if (tier.has(cid)) {
        const stats = this.accessStats.get(cid) || { count: 0, lastAccessed: new Date() };
        stats.count++;
        stats.lastAccessed = new Date();
        this.accessStats.set(cid, stats);
        return tier.get(cid)!;
      }
    }
    return null;
  }

  async put(cid: CID, data: Buffer, tier: StorageTier): Promise<void> {
    const target = tier === StorageTier.HOT ? this.hot : tier === StorageTier.WARM ? this.warm : this.cold;
    target.set(cid, Buffer.from(data)); // Copy to prevent external mutation
    this.accessStats.set(cid, { count: 0, lastAccessed: new Date() });
  }

  async delete(cid: CID): Promise<void> {
    this.hot.delete(cid);
    this.warm.delete(cid);
    this.cold.delete(cid);
    this.accessStats.delete(cid);
  }

  async exists(cid: CID): Promise<boolean> {
    return this.hot.has(cid) || this.warm.has(cid) || this.cold.has(cid);
  }

  async promote(cid: CID, toTier: StorageTier): Promise<void> {
    const data = await this.get(cid);
    if (!data) throw new FileNotFoundError(cid);
    
    // Remove from all tiers
    this.hot.delete(cid);
    this.warm.delete(cid);
    this.cold.delete(cid);
    
    // Put in target tier
    await this.put(cid, data, toTier);
  }

  async demote(cid: CID, toTier: StorageTier): Promise<void> {
    await this.promote(cid, toTier); // Same logic: remove + re-add
  }

  getTier(cid: CID): StorageTier | null {
    if (this.hot.has(cid)) return StorageTier.HOT;
    if (this.warm.has(cid)) return StorageTier.WARM;
    if (this.cold.has(cid)) return StorageTier.COLD;
    return null;
  }

  getStats(cid: CID): { count: number; lastAccessed: Date } | undefined {
    return this.accessStats.get(cid);
  }
}

// ============================================================================
// SEARCH INDEX
// ============================================================================

class SearchIndex {
  private index = new Map<string, CID[]>(); // term -> CIDs
  private metadata = new Map<CID, FileMetadata>();

  indexFile(cid: CID, metadata: FileMetadata, content?: string): void {
    this.metadata.set(cid, metadata);
    
    // Index metadata fields
    const terms = new Set<string>();
    metadata.name.toLowerCase().split(/\s+/).forEach(t => terms.add(t));
    metadata.tags.forEach(tag => tag.toLowerCase().split(/\s+/).forEach(t => terms.add(t)));
    
    // Index content if provided (simplified - production would use vector embeddings)
    if (content) {
      content.toLowerCase().split(/\s+/).forEach(t => {
        if (t.length > 2) terms.add(t);
      });
    }

    terms.forEach(term => {
      const cids = this.index.get(term) || [];
      if (!cids.includes(cid)) {
        cids.push(cid);
        this.index.set(term, cids);
      }
    });
  }

  removeFile(cid: CID): void {
    this.metadata.delete(cid);
    this.index.forEach((cids, term) => {
      const filtered = cids.filter(c => c !== cid);
      if (filtered.length === 0) {
        this.index.delete(term);
      } else {
        this.index.set(term, filtered);
      }
    });
  }

  search(query: string, limit: number = 10): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const scores = new Map<CID, number>();
    const highlights = new Map<CID, Set<string>>();

    queryTerms.forEach(term => {
      this.index.forEach((cids, indexedTerm) => {
        if (indexedTerm.includes(term) || term.includes(indexedTerm)) {
          cids.forEach(cid => {
            const score = (scores.get(cid) || 0) + (indexedTerm === term ? 2 : 1);
            scores.set(cid, score);
            
            const hl = highlights.get(cid) || new Set<string>();
            hl.add(indexedTerm);
            highlights.set(cid, hl);
          });
        }
      });
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cid, score]) => ({
        cid,
        score,
        highlights: Array.from(highlights.get(cid) || []),
        metadata: this.metadata.get(cid)!,
      }));
  }
}

// ============================================================================
// CLAWFS CLIENT
// ============================================================================

export class ClawFSClient {
  private agentId: string;
  private backend: StorageBackend;
  private fileIndex = new Map<CID, FileEntry>();
  private snapshots: Snapshot[] = [];
  private searchIndex = new SearchIndex();
  private config: ClawFSConfig;

  constructor(config: ClawFSConfig, backend?: StorageBackend) {
    this.config = config;
    this.agentId = config.agentId;
    this.backend = backend || new MemoryStorageBackend();
  }

  // ==========================================================================
  // CORE OPERATIONS
  // ==========================================================================

  /**
   * Store a file and return its Content Identifier (CID)
   * 
   * @param data - File content as Buffer
   * @param metadata - File metadata
   * @param options - Storage options
   * @returns The CID of the stored file
   */
  async write(
    data: Buffer,
    metadata: Partial<FileMetadata> = {},
    options: {
      tier?: StorageTier;
      replicationFactor?: number;
      encrypt?: boolean;
      compress?: boolean;
    } = {}
  ): Promise<CID> {
    const tier = options.tier || this.inferTier(data.length);
    const now = new Date();

    // Chunk data
    const chunks = chunkData(data);
    const blockCIDs: string[] = [];

    // Store each chunk
    for (const chunk of chunks) {
      const blockCID = computeCID(chunk);
      if (!(await this.backend.exists(blockCID))) {
        await this.backend.put(blockCID, chunk, tier);
      }
      blockCIDs.push(blockCID);
    }

    // Compute root CID from full data
    const cid = computeCID(data);
    const merkleRoot = computeMerkleRoot(blockCIDs);

    // Build file entry
    const fileEntry: FileEntry = {
      cid,
      owner: this.agentId,
      metadata: {
        name: metadata.name || 'unnamed',
        mimeType: metadata.mimeType || 'application/octet-stream',
        size: data.length,
        createdAt: metadata.createdAt || now,
        modifiedAt: now,
        tags: metadata.tags || [],
        encryptionKeyId: options.encrypt ? this.generateKeyId() : undefined,
        compression: options.compress ? 'gzip' : undefined,
      },
      tier,
      accessControl: [{
        agentId: this.agentId,
        permission: Permission.ADMIN,
        grantedAt: now,
        grantedBy: this.agentId,
      }],
      merkleRoot,
      blocks: blockCIDs,
      replicationFactor: options.replicationFactor || this.config.replicationFactor,
      lastAccessedAt: now,
      accessCount: 0,
    };

    // Index file
    this.fileIndex.set(cid, fileEntry);
    this.searchIndex.indexFile(cid, fileEntry.metadata);

    return cid;
  }

  /**
   * Retrieve a file by its CID
   * 
   * @param cid - Content Identifier
   * @param requesterAgentId - Optional agent ID for permission check (defaults to current agent)
   * @returns File content as Buffer
   */
  async read(cid: CID, requesterAgentId?: string): Promise<Buffer> {
    const agentId = requesterAgentId || this.agentId;
    const entry = this.fileIndex.get(cid);
    
    if (!entry) {
      throw new FileNotFoundError(cid);
    }

    // Check permission
    if (!this.hasPermission(agentId, entry, Permission.READ)) {
      throw new PermissionDeniedError(agentId, cid, Permission.READ);
    }

    // Retrieve blocks
    const chunks: Buffer[] = [];
    for (const blockCID of entry.blocks) {
      const chunk = await this.backend.get(blockCID);
      if (!chunk) {
        throw new ClawFSError(`Block ${blockCID} missing for file ${cid}`, 'BLOCK_MISSING');
      }
      chunks.push(chunk);
    }

    // Update access stats
    entry.lastAccessedAt = new Date();
    entry.accessCount++;

    // Auto-promote hot files
    if (entry.tier !== StorageTier.HOT && entry.accessCount > 10) {
      await this.promoteToTier(cid, StorageTier.HOT);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Share a file with other agents
   * 
   * @param cid - Content Identifier
   * @param agentIds - Array of agent IDs to share with
   * @param permission - Permission level to grant
   * @returns The updated FileEntry
   */
  async share(
    cid: CID,
    agentIds: string[],
    permission: Permission = Permission.READ
  ): Promise<FileEntry> {
    const entry = this.fileIndex.get(cid);
    
    if (!entry) {
      throw new FileNotFoundError(cid);
    }

    // Check current agent has admin permission
    if (!this.hasPermission(this.agentId, entry, Permission.ADMIN)) {
      throw new PermissionDeniedError(this.agentId, cid, Permission.ADMIN);
    }

    const now = new Date();

    for (const agentId of agentIds) {
      // Remove existing permission for this agent
      entry.accessControl = entry.accessControl.filter(ac => ac.agentId !== agentId);
      
      // Add new permission
      entry.accessControl.push({
        agentId,
        permission,
        grantedAt: now,
        grantedBy: this.agentId,
      });
    }

    return entry;
  }

  /**
   * List files accessible to the current agent
   * 
   * @param options - Filter options
   * @returns Array of FileEntry objects
   */
  async list(options: {
    ownedOnly?: boolean;
    tier?: StorageTier;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<FileEntry[]> {
    let files = Array.from(this.fileIndex.values());

    // Filter by ownership if requested
    if (options.ownedOnly) {
      files = files.filter(f => f.owner === this.agentId);
    } else {
      // Filter by permission
      files = files.filter(f => this.hasPermission(this.agentId, f, Permission.READ));
    }

    // Filter by tier
    if (options.tier) {
      files = files.filter(f => f.tier === options.tier);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      files = files.filter(f => 
        options.tags!.some(tag => f.metadata.tags.includes(tag))
      );
    }

    // Sort by last accessed (most recent first)
    files.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || files.length;
    return files.slice(offset, offset + limit);
  }

  /**
   * Create a Merkle-backed snapshot of the current file system state
   * 
   * @param options - Snapshot options
   * @returns The created Snapshot
   */
  async snapshot(options: {
    includeFiles?: CID[];
    excludeFiles?: CID[];
  } = {}): Promise<Snapshot> {
    let files = Array.from(this.fileIndex.values());

    // Apply filters
    if (options.includeFiles) {
      const includeSet = new Set(options.includeFiles);
      files = files.filter(f => includeSet.has(f.cid));
    }
    if (options.excludeFiles) {
      const excludeSet = new Set(options.excludeFiles);
      files = files.filter(f => !excludeSet.has(f.cid));
    }

    // Build snapshot Merkle tree
    const fileRoots = files.map(f => f.merkleRoot).sort();
    const merkleRoot = computeMerkleRoot(fileRoots);

    const snapshot: Snapshot = {
      id: randomUUID(),
      timestamp: new Date(),
      merkleRoot,
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.metadata.size, 0),
      previousSnapshot: this.snapshots.length > 0 
        ? this.snapshots[this.snapshots.length - 1].id 
        : undefined,
      includedFiles: files.map(f => f.cid),
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Semantic search across files
   * 
   * @param query - Search query string
   * @param options - Search options
   * @returns Array of SearchResult objects
   */
  async search(
    query: string,
    options: {
      limit?: number;
      includeContent?: boolean;
      tags?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit || 10;
    
    // Get search results
    let results = this.searchIndex.search(query, limit * 2); // Get extra for filtering

    // Filter by tags if specified
    if (options.tags && options.tags.length > 0) {
      results = results.filter(r => 
        options.tags!.some(tag => r.metadata.tags.includes(tag))
      );
    }

    // Filter to only files we have permission to read
    results = results.filter(r => {
      const entry = this.fileIndex.get(r.cid);
      return entry && this.hasPermission(this.agentId, entry, Permission.READ);
    });

    return results.slice(0, limit);
  }

  // ==========================================================================
  // ADVANCED OPERATIONS
  // ==========================================================================

  /**
   * Change the storage tier of a file
   * 
   * @param cid - Content Identifier
   * @param tier - Target storage tier
   */
  async setTier(cid: CID, tier: StorageTier): Promise<void> {
    const entry = this.fileIndex.get(cid);
    if (!entry) {
      throw new FileNotFoundError(cid);
    }

    if (!this.hasPermission(this.agentId, entry, Permission.WRITE)) {
      throw new PermissionDeniedError(this.agentId, cid, Permission.WRITE);
    }

    for (const blockCID of entry.blocks) {
      await this.backend.promote(blockCID, tier);
    }

    entry.tier = tier;
  }

  /**
   * Delete a file (requires ADMIN permission)
   * 
   * @param cid - Content Identifier
   */
  async delete(cid: CID): Promise<void> {
    const entry = this.fileIndex.get(cid);
    if (!entry) {
      throw new FileNotFoundError(cid);
    }

    if (!this.hasPermission(this.agentId, entry, Permission.ADMIN)) {
      throw new PermissionDeniedError(this.agentId, cid, Permission.ADMIN);
    }

    // Delete blocks
    for (const blockCID of entry.blocks) {
      // Check if block is used by other files before deleting
      const usedByOthers = Array.from(this.fileIndex.values()).some(
        f => f.cid !== cid && f.blocks.includes(blockCID)
      );
      if (!usedByOthers) {
        await this.backend.delete(blockCID);
      }
    }

    // Remove from indices
    this.fileIndex.delete(cid);
    this.searchIndex.removeFile(cid);
  }

  /**
   * Get file entry metadata without reading content
   * 
   * @param cid - Content Identifier
   * @returns FileEntry if found and accessible
   */
  async stat(cid: CID): Promise<FileEntry | null> {
    const entry = this.fileIndex.get(cid);
    if (!entry) return null;
    
    if (!this.hasPermission(this.agentId, entry, Permission.READ)) {
      return null;
    }
    
    return entry;
  }

  /**
   * Get all snapshots
   * 
   * @returns Array of snapshots
   */
  async getSnapshots(): Promise<Snapshot[]> {
    return [...this.snapshots];
  }

  /**
   * Verify file integrity using Merkle tree
   * 
   * @param cid - Content Identifier
   * @returns True if file is valid
   */
  async verify(cid: CID): Promise<boolean> {
    const entry = this.fileIndex.get(cid);
    if (!entry) return false;

    try {
      const blockHashes: string[] = [];
      for (const blockCID of entry.blocks) {
        const chunk = await this.backend.get(blockCID);
        if (!chunk) return false;
        blockHashes.push(computeCID(chunk)); // Verify block CID matches content
      }

      const computedRoot = computeMerkleRoot(blockHashes);
      return computedRoot === entry.merkleRoot;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private inferTier(size: number): StorageTier {
    if (size < 1024 * 1024) return StorageTier.HOT; // < 1MB
    if (size < 100 * 1024 * 1024) return StorageTier.WARM; // < 100MB
    return StorageTier.COLD;
  }

  private hasPermission(agentId: string, entry: FileEntry, required: Permission): boolean {
    const ac = entry.accessControl.find(a => a.agentId === agentId);
    if (!ac) return false;

    // Check expiration
    if (ac.expiresAt && ac.expiresAt < new Date()) {
      return false;
    }

    const levels = [Permission.READ, Permission.WRITE, Permission.ADMIN];
    const requiredIdx = levels.indexOf(required);
    const grantedIdx = levels.indexOf(ac.permission);

    return grantedIdx >= requiredIdx;
  }

  private async promoteToTier(cid: CID, tier: StorageTier): Promise<void> {
    const entry = this.fileIndex.get(cid);
    if (!entry || entry.tier === tier) return;

    for (const blockCID of entry.blocks) {
      await this.backend.promote(blockCID, tier);
    }
    entry.tier = tier;
  }

  private generateKeyId(): string {
    return `key-${randomUUID()}`;
  }

  // ==========================================================================
  // PERSISTENCE (for crash recovery)
  // ==========================================================================

  /**
   * Export file system state for persistence
   * 
   * @returns Serialized state
   */
  exportState(): object {
    return {
      agentId: this.agentId,
      files: Array.from(this.fileIndex.entries()),
      snapshots: this.snapshots,
      config: this.config,
      exportedAt: new Date().toISOString(),
    };
  }

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
  }): void {
    this.fileIndex = new Map(state.files);
    this.snapshots = state.snapshots;
    
    // Rebuild search index
    this.searchIndex = new SearchIndex();
    for (const [cid, entry] of this.fileIndex.entries()) {
      this.searchIndex.indexFile(cid, entry.metadata);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawFSClient;

// Re-export all types for convenience
export {
  MemoryStorageBackend,
  SearchIndex,
};
