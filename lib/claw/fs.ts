/**
 * @fileoverview ClawFS - Distributed File System for MoltOS
 * @description Content-addressed distributed storage with hot/warm/cold tiers
 * @version 1.0.0
 */

import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { Readable } from 'stream';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Storage tier definitions
 * - HOT: Frequently accessed, local SSD/memory (7 days default)
 * - WARM: Occasionally accessed, local disk (30 days default)  
 * - COLD: Rarely accessed, compressed + backup (indefinite)
 */
export type StorageTier = 'hot' | 'warm' | 'cold';

/**
 * Content Identifier (CID) - SHA-256 hash of content
 */
export type CID = string;

/**
 * File metadata and system tracking
 */
export interface FileMetadata {
  cid: CID;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  tier: StorageTier;
  owner: string; // Agent ID
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  accessCount: number;
  sharedWith: string[]; // Agent IDs with access
  permissions: FilePermissions;
  tags: string[];
  checksum: string;
  encryption?: EncryptionInfo;
  replicas: ReplicaInfo[];
  expiresAt?: Date;
}

export interface FilePermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
  share: boolean;
}

export interface EncryptionInfo {
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  keyId: string;
  encryptedAt: Date;
}

export interface ReplicaInfo {
  nodeId: string;
  tier: StorageTier;
  location: string;
  createdAt: Date;
  lastVerified: Date;
  status: 'healthy' | 'degraded' | 'missing';
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  byTier: Record<StorageTier, { files: number; size: number }>;
  byOwner: Record<string, { files: number; size: number }>;
}

export interface UploadOptions {
  tier?: StorageTier;
  encrypt?: boolean;
  tags?: string[];
  expiresInDays?: number;
  replicas?: number;
}

export interface ShareOptions {
  agentIds: string[];
  permissions?: Partial<FilePermissions>;
  expiresInDays?: number;
}

export interface ListOptions {
  owner?: string;
  tier?: StorageTier;
  tags?: string[];
  path?: string;
  recursive?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ClawFSConfig {
  basePath: string;
  hotPath: string;
  warmPath: string;
  coldPath: string;
  maxHotSize: number;      // Max size for hot tier (default 100MB)
  maxWarmSize: number;     // Max size for warm tier (default 1GB)
  hotRetentionDays: number;
  warmRetentionDays: number;
  defaultReplicas: number;
  enableEncryption: boolean;
  compressionLevel: number;
}

const DEFAULT_CONFIG: ClawFSConfig = {
  basePath: process.env.CLAWFS_BASE_PATH || './.clawfs',
  hotPath: process.env.CLAWFS_HOT_PATH || './.clawfs/hot',
  warmPath: process.env.CLAWFS_WARM_PATH || './.clawfs/warm',
  coldPath: process.env.CLAWFS_COLD_PATH || './.clawfs/cold',
  maxHotSize: 100 * 1024 * 1024,      // 100MB
  maxWarmSize: 1024 * 1024 * 1024,    // 1GB
  hotRetentionDays: 7,
  warmRetentionDays: 30,
  defaultReplicas: 2,
  enableEncryption: true,
  compressionLevel: 6,
};

// ============================================================================
// CID UTILITIES
// ============================================================================

/**
 * Generate Content Identifier (CID) from buffer
 * Uses SHA-256 for content addressing
 */
export function generateCID(buffer: Buffer): CID {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate a shorter display CID (first 16 chars)
 */
export function shortCID(cid: CID): string {
  return cid.substring(0, 16);
}

/**
 * Verify content matches CID
 */
export function verifyCID(buffer: Buffer, cid: CID): boolean {
  return generateCID(buffer) === cid;
}

// ============================================================================
// STORAGE TIER MANAGEMENT
// ============================================================================

class TierManager {
  private config: ClawFSConfig;

  constructor(config: ClawFSConfig) {
    this.config = config;
  }

  /**
   * Determine optimal tier based on file size and access patterns
   */
  determineTier(size: number, requestedTier?: StorageTier): StorageTier {
    if (requestedTier) return requestedTier;
    
    if (size <= this.config.maxHotSize) return 'hot';
    if (size <= this.config.maxWarmSize) return 'warm';
    return 'cold';
  }

  /**
   * Check if file should be promoted to hotter tier
   */
  shouldPromote(metadata: FileMetadata): boolean {
    const accessAge = Date.now() - metadata.accessedAt.getTime();
    const hotThreshold = 3; // Accessed 3+ times
    
    if (metadata.tier === 'warm' && metadata.accessCount >= hotThreshold) {
      return metadata.size <= this.config.maxHotSize;
    }
    if (metadata.tier === 'cold' && metadata.accessCount >= hotThreshold) {
      return metadata.size <= this.config.maxWarmSize;
    }
    return false;
  }

  /**
   * Check if file should be demoted to colder tier
   */
  shouldDemote(metadata: FileMetadata): boolean {
    const accessAge = Date.now() - metadata.accessedAt.getTime();
    
    if (metadata.tier === 'hot') {
      return accessAge > this.config.hotRetentionDays * 24 * 60 * 60 * 1000;
    }
    if (metadata.tier === 'warm') {
      return accessAge > this.config.warmRetentionDays * 24 * 60 * 60 * 1000;
    }
    return false;
  }

  /**
   * Get storage path for tier
   */
  getTierPath(tier: StorageTier): string {
    switch (tier) {
      case 'hot': return this.config.hotPath;
      case 'warm': return this.config.warmPath;
      case 'cold': return this.config.coldPath;
    }
  }
}

// ============================================================================
// INDEX & METADATA STORE
// ============================================================================

class MetadataStore {
  private indexPath: string;
  private metadata: Map<CID, FileMetadata> = new Map();
  private pathIndex: Map<string, CID> = new Map();
  private initialized: boolean = false;

  constructor(basePath: string) {
    this.indexPath = join(basePath, 'index.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      for (const [cid, meta] of Object.entries(parsed.metadata || {})) {
        this.metadata.set(cid, this.deserializeMetadata(meta as Record<string, unknown>));
      }
      
      this.pathIndex = new Map(Object.entries(parsed.paths || {}));
    } catch (error) {
      // Index doesn't exist yet, start fresh
    }
    
    this.initialized = true;
  }

  async save(): Promise<void> {
    const data = {
      metadata: Object.fromEntries(
        Array.from(this.metadata.entries()).map(([k, v]) => [k, this.serializeMetadata(v)])
      ),
      paths: Object.fromEntries(this.pathIndex),
      updatedAt: new Date().toISOString(),
    };

    await fs.mkdir(dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2));
  }

  get(cid: CID): FileMetadata | undefined {
    return this.metadata.get(cid);
  }

  getByPath(path: string): FileMetadata | undefined {
    const cid = this.pathIndex.get(this.normalizePath(path));
    return cid ? this.metadata.get(cid) : undefined;
  }

  set(metadata: FileMetadata): void {
    this.metadata.set(metadata.cid, metadata);
    this.pathIndex.set(this.normalizePath(metadata.path), metadata.cid);
  }

  delete(cid: CID): boolean {
    const meta = this.metadata.get(cid);
    if (meta) {
      this.metadata.delete(cid);
      this.pathIndex.delete(this.normalizePath(meta.path));
      return true;
    }
    return false;
  }

  list(options: ListOptions = {}): FileMetadata[] {
    let files = Array.from(this.metadata.values());

    if (options.owner) {
      files = files.filter(f => f.owner === options.owner);
    }
    if (options.tier) {
      files = files.filter(f => f.tier === options.tier);
    }
    if (options.tags && options.tags.length > 0) {
      files = files.filter(f => options.tags!.some(tag => f.tags.includes(tag)));
    }
    if (options.path) {
      const prefix = this.normalizePath(options.path);
      files = files.filter(f => 
        options.recursive ? f.path.startsWith(prefix) : dirname(f.path) === prefix
      );
    }

    // Sort by modified date (newest first)
    files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    if (options.offset) {
      files = files.slice(options.offset);
    }
    if (options.limit) {
      files = files.slice(0, options.limit);
    }

    return files;
  }

  getStats(): StorageStats {
    const stats: StorageStats = {
      totalFiles: 0,
      totalSize: 0,
      byTier: { hot: { files: 0, size: 0 }, warm: { files: 0, size: 0 }, cold: { files: 0, size: 0 } },
      byOwner: {},
    };

    for (const meta of this.metadata.values()) {
      stats.totalFiles++;
      stats.totalSize += meta.size;
      stats.byTier[meta.tier].files++;
      stats.byTier[meta.tier].size += meta.size;

      if (!stats.byOwner[meta.owner]) {
        stats.byOwner[meta.owner] = { files: 0, size: 0 };
      }
      stats.byOwner[meta.owner].files++;
      stats.byOwner[meta.owner].size += meta.size;
    }

    return stats;
  }

  private normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private serializeMetadata(meta: FileMetadata): Record<string, unknown> {
    return {
      ...meta,
      createdAt: meta.createdAt.toISOString(),
      modifiedAt: meta.modifiedAt.toISOString(),
      accessedAt: meta.accessedAt.toISOString(),
      expiresAt: meta.expiresAt?.toISOString(),
      replicas: meta.replicas.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        lastVerified: r.lastVerified.toISOString(),
      })),
      encryption: meta.encryption ? {
        ...meta.encryption,
        encryptedAt: meta.encryption.encryptedAt.toISOString(),
      } : undefined,
    };
  }

  private deserializeMetadata(data: Record<string, unknown>): FileMetadata {
    return {
      ...(data as FileMetadata),
      createdAt: new Date(data.createdAt as string),
      modifiedAt: new Date(data.modifiedAt as string),
      accessedAt: new Date(data.accessedAt as string),
      expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
      replicas: (data.replicas as Record<string, unknown>[] || []).map(r => ({
        ...(r as unknown as ReplicaInfo),
        createdAt: new Date(r.createdAt as string),
        lastVerified: new Date(r.lastVerified as string),
      })),
      encryption: data.encryption ? {
        ...(data.encryption as unknown as EncryptionInfo),
        encryptedAt: new Date((data.encryption as Record<string, string>).encryptedAt),
      } : undefined,
    };
  }
}

// ============================================================================
// MAIN CLAWFS SERVICE
// ============================================================================

export class ClawFSService {
  private config: ClawFSConfig;
  private tierManager: TierManager;
  private metadataStore: MetadataStore;
  private initialized: boolean = false;

  constructor(config: Partial<ClawFSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tierManager = new TierManager(this.config);
    this.metadataStore = new MetadataStore(this.config.basePath);
  }

  /**
   * Initialize storage directories and load index
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create storage directories
    await fs.mkdir(this.config.hotPath, { recursive: true });
    await fs.mkdir(this.config.warmPath, { recursive: true });
    await fs.mkdir(this.config.coldPath, { recursive: true });

    // Load metadata index
    await this.metadataStore.initialize();

    this.initialized = true;
  }

  /**
   * Upload file to ClawFS
   * Content-addressed storage - duplicate content returns existing CID
   */
  async upload(
    path: string,
    data: Buffer | string,
    owner: string,
    options: UploadOptions = {}
  ): Promise<FileMetadata> {
    await this.initialize();

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const cid = generateCID(buffer);
    const size = buffer.length;

    // Check if content already exists
    const existing = this.metadataStore.get(cid);
    if (existing) {
      // Content deduplication - return existing metadata
      return existing;
    }

    // Determine storage tier
    const tier = this.tierManager.determineTier(size, options.tier);
    const tierPath = this.tierManager.getTierPath(tier);

    // Store file
    const storagePath = this.getStoragePath(cid, tier);
    await fs.mkdir(dirname(storagePath), { recursive: true });
    await fs.writeFile(storagePath, buffer);

    // Create metadata
    const now = new Date();
    const metadata: FileMetadata = {
      cid,
      name: basename(path),
      path: path.startsWith('/') ? path : `/${path}`,
      size,
      mimeType: this.detectMimeType(path),
      tier,
      owner,
      createdAt: now,
      modifiedAt: now,
      accessedAt: now,
      accessCount: 0,
      sharedWith: [],
      permissions: {
        read: true,
        write: true,
        delete: true,
        share: true,
      },
      tags: options.tags || [],
      checksum: cid, // CID is the checksum
      replicas: [{
        nodeId: 'local',
        tier,
        location: storagePath,
        createdAt: now,
        lastVerified: now,
        status: 'healthy',
      }],
      expiresAt: options.expiresInDays 
        ? new Date(now.getTime() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    };

    // Save metadata
    this.metadataStore.set(metadata);
    await this.metadataStore.save();

    return metadata;
  }

  /**
   * Download file by path or CID
   */
  async download(identifier: string, requester: string): Promise<{ data: Buffer; metadata: FileMetadata }> {
    await this.initialize();

    // Try to find by path first, then by CID
    let metadata = this.metadataStore.getByPath(identifier);
    if (!metadata) {
      metadata = this.metadataStore.get(identifier);
    }

    if (!metadata) {
      throw new ClawFSError('FILE_NOT_FOUND', `File not found: ${identifier}`);
    }

    // Check permissions
    if (!this.hasPermission(metadata, requester, 'read')) {
      throw new ClawFSError('ACCESS_DENIED', 'You do not have permission to read this file');
    }

    // Read file from storage
    const storagePath = this.getStoragePath(metadata.cid, metadata.tier);
    const data = await fs.readFile(storagePath);

    // Verify integrity
    if (!verifyCID(data, metadata.cid)) {
      throw new ClawFSError('CORRUPTED_DATA', 'File integrity check failed');
    }

    // Update access tracking
    metadata.accessedAt = new Date();
    metadata.accessCount++;
    this.metadataStore.set(metadata);
    await this.metadataStore.save();

    // Check for tier promotion
    if (this.tierManager.shouldPromote(metadata)) {
      await this.promoteFile(metadata);
    }

    return { data, metadata };
  }

  /**
   * Read file as text
   */
  async read(path: string, requester: string): Promise<string> {
    const { data } = await this.download(path, requester);
    return data.toString('utf-8');
  }

  /**
   * Write file (create or overwrite)
   */
  async write(
    path: string,
    data: string | Buffer,
    owner: string,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    // Check if file exists and has write permission
    const existing = this.metadataStore.getByPath(path);
    if (existing && !this.hasPermission(existing, owner, 'write')) {
      throw new ClawFSError('ACCESS_DENIED', 'You do not have permission to write this file');
    }

    // Upload new content
    return this.upload(path, data, owner, options);
  }

  /**
   * Delete file
   */
  async delete(identifier: string, requester: string): Promise<boolean> {
    await this.initialize();

    const metadata = this.metadataStore.getByPath(identifier) || this.metadataStore.get(identifier);
    if (!metadata) {
      return false;
    }

    if (!this.hasPermission(metadata, requester, 'delete')) {
      throw new ClawFSError('ACCESS_DENIED', 'You do not have permission to delete this file');
    }

    // Remove from storage
    const storagePath = this.getStoragePath(metadata.cid, metadata.tier);
    try {
      await fs.unlink(storagePath);
    } catch (error) {
      // File may already be deleted
    }

    // Remove from index
    this.metadataStore.delete(metadata.cid);
    await this.metadataStore.save();

    return true;
  }

  /**
   * Share file with other agents
   */
  async share(identifier: string, owner: string, options: ShareOptions): Promise<FileMetadata> {
    await this.initialize();

    const metadata = this.metadataStore.getByPath(identifier) || this.metadataStore.get(identifier);
    if (!metadata) {
      throw new ClawFSError('FILE_NOT_FOUND', `File not found: ${identifier}`);
    }

    if (!this.hasPermission(metadata, owner, 'share')) {
      throw new ClawFSError('ACCESS_DENIED', 'You do not have permission to share this file');
    }

    // Add shared agents
    for (const agentId of options.agentIds) {
      if (!metadata.sharedWith.includes(agentId)) {
        metadata.sharedWith.push(agentId);
      }
    }

    metadata.modifiedAt = new Date();
    this.metadataStore.set(metadata);
    await this.metadataStore.save();

    return metadata;
  }

  /**
   * Revoke access from agents
   */
  async revokeShare(identifier: string, owner: string, agentIds: string[]): Promise<FileMetadata> {
    await this.initialize();

    const metadata = this.metadataStore.getByPath(identifier) || this.metadataStore.get(identifier);
    if (!metadata) {
      throw new ClawFSError('FILE_NOT_FOUND', `File not found: ${identifier}`);
    }

    if (metadata.owner !== owner) {
      throw new ClawFSError('ACCESS_DENIED', 'Only the owner can revoke shares');
    }

    metadata.sharedWith = metadata.sharedWith.filter(id => !agentIds.includes(id));
    metadata.modifiedAt = new Date();
    this.metadataStore.set(metadata);
    await this.metadataStore.save();

    return metadata;
  }

  /**
   * List files with filters
   */
  async list(options: ListOptions = {}): Promise<FileMetadata[]> {
    await this.initialize();
    return this.metadataStore.list(options);
  }

  /**
   * Get file metadata
   */
  async getMetadata(identifier: string, requester: string): Promise<FileMetadata> {
    await this.initialize();

    const metadata = this.metadataStore.getByPath(identifier) || this.metadataStore.get(identifier);
    if (!metadata) {
      throw new ClawFSError('FILE_NOT_FOUND', `File not found: ${identifier}`);
    }

    if (!this.hasPermission(metadata, requester, 'read')) {
      throw new ClawFSError('ACCESS_DENIED', 'You do not have permission to read this file');
    }

    return metadata;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.initialize();
    return this.metadataStore.getStats();
  }

  /**
   * Move file to different tier
   */
  async migrateTier(identifier: string, newTier: StorageTier, requester: string): Promise<FileMetadata> {
    await this.initialize();

    const metadata = this.metadataStore.getByPath(identifier) || this.metadataStore.get(identifier);
    if (!metadata) {
      throw new ClawFSError('FILE_NOT_FOUND', `File not found: ${identifier}`);
    }

    if (metadata.owner !== requester) {
      throw new ClawFSError('ACCESS_DENIED', 'Only the owner can migrate file tiers');
    }

    if (metadata.tier === newTier) {
      return metadata;
    }

    // Read from current tier
    const oldPath = this.getStoragePath(metadata.cid, metadata.tier);
    const data = await fs.readFile(oldPath);

    // Write to new tier
    const newPath = this.getStoragePath(metadata.cid, newTier);
    await fs.mkdir(dirname(newPath), { recursive: true });
    await fs.writeFile(newPath, data);

    // Delete from old tier
    await fs.unlink(oldPath);

    // Update metadata
    metadata.tier = newTier;
    metadata.modifiedAt = new Date();
    metadata.replicas[0].tier = newTier;
    metadata.replicas[0].location = newPath;
    
    this.metadataStore.set(metadata);
    await this.metadataStore.save();

    return metadata;
  }

  /**
   * Run maintenance tasks (tier migrations, cleanup)
   */
  async runMaintenance(): Promise<{
    promoted: number;
    demoted: number;
    cleaned: number;
  }> {
    await this.initialize();

    const result = { promoted: 0, demoted: 0, cleaned: 0 };

    for (const metadata of this.metadataStore.list()) {
      // Check for expired files
      if (metadata.expiresAt && metadata.expiresAt < new Date()) {
        await this.delete(metadata.path, metadata.owner);
        result.cleaned++;
        continue;
      }

      // Check for tier demotion
      if (this.tierManager.shouldDemote(metadata)) {
        const newTier = metadata.tier === 'hot' ? 'warm' : 'cold';
        await this.migrateTier(metadata.path, newTier, metadata.owner);
        result.demoted++;
      }
    }

    return result;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getStoragePath(cid: CID, tier: StorageTier): string {
    // Sharded storage: /tier/aa/bb/aabbcc...rest
    const shard1 = cid.substring(0, 2);
    const shard2 = cid.substring(2, 4);
    const tierPath = this.tierManager.getTierPath(tier);
    return join(tierPath, shard1, shard2, cid);
  }

  private hasPermission(metadata: FileMetadata, requester: string, action: keyof FilePermissions): boolean {
    // Owner has all permissions
    if (metadata.owner === requester) return true;
    
    // Shared agents have read by default
    if (metadata.sharedWith.includes(requester)) {
      return action === 'read';
    }
    
    return false;
  }

  private async promoteFile(metadata: FileMetadata): Promise<void> {
    const newTier: StorageTier = metadata.tier === 'cold' ? 'warm' : 'hot';
    await this.migrateTier(metadata.path, newTier, metadata.owner);
  }

  private detectMimeType(path: string): string {
    const ext = extname(path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.gz': 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class ClawFSError extends Error {
  public code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ClawFSError';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalInstance: ClawFSService | null = null;

export function getClawFS(config?: Partial<ClawFSConfig>): ClawFSService {
  if (!globalInstance) {
    globalInstance = new ClawFSService(config);
  }
  return globalInstance;
}

export function resetClawFS(): void {
  globalInstance = null;
}

// ============================================================================
// SDK INTERFACE
// ============================================================================

/**
 * MoltOS SDK File System Interface
 * Usage: moltos.fs.write("/data/file.csv", data)
 */
export interface MoltosFS {
  write(path: string, data: string | Buffer, options?: UploadOptions): Promise<FileMetadata>;
  read(path: string): Promise<string>;
  readBuffer(path: string): Promise<Buffer>;
  delete(path: string): Promise<boolean>;
  list(path?: string): Promise<FileMetadata[]>;
  share(path: string, agentIds: string[]): Promise<FileMetadata>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileMetadata>;
}

/**
 * Create MoltOS SDK instance for an agent
 */
export function createMoltosFS(agentId: string, service?: ClawFSService): MoltosFS {
  const fs = service || getClawFS();

  return {
    async write(path: string, data: string | Buffer, options?: UploadOptions): Promise<FileMetadata> {
      return fs.write(path, data, agentId, options);
    },

    async read(path: string): Promise<string> {
      return fs.read(path, agentId);
    },

    async readBuffer(path: string): Promise<Buffer> {
      const { data } = await fs.download(path, agentId);
      return data;
    },

    async delete(path: string): Promise<boolean> {
      return fs.delete(path, agentId);
    },

    async list(path?: string): Promise<FileMetadata[]> {
      return fs.list({ path, owner: agentId });
    },

    async share(path: string, agentIds: string[]): Promise<FileMetadata> {
      return fs.share(path, agentId, { agentIds });
    },

    async exists(path: string): Promise<boolean> {
      try {
        await fs.getMetadata(path, agentId);
        return true;
      } catch {
        return false;
      }
    },

    async stat(path: string): Promise<FileMetadata> {
      return fs.getMetadata(path, agentId);
    },
  };
}

// Default export
export default ClawFSService;
