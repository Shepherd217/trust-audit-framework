/**
 * ClawFS Core Service
 * File operations for agents with semantic search, tiered storage, and access control
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Types imported from types.ts
export interface AgentIdentity {
  id: string;
  name: string;
  publicKey?: string;
}

export interface FileObject {
  id: string;
  cid: string; // Content hash
  ownerId: string;
  content: string | Buffer;
  metadata: FileMetadata;
  permissions: Permission[];
  version: number;
  parentId?: string; // For version history
  storageTier: StorageTier;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  deletedAt?: Date;
}

export interface FileMetadata {
  name: string;
  mimeType: string;
  size: number;
  tags?: string[];
  description?: string;
  embedding?: number[]; // Vector embedding for semantic search
  [key: string]: any;
}

export interface Permission {
  agentId: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  grantedAt: Date;
  grantedBy: string;
}

export interface AccessPolicy {
  fileId: string;
  ownerId: string;
  permissions: Permission[];
  isPublic: boolean;
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  cid: string;
  createdAt: Date;
  createdBy: string;
  changeSummary?: string;
}

export enum StorageTier {
  HOT = 'hot',     // Frequently accessed, in-memory/SSD
  WARM = 'warm',   // Occasionally accessed, standard storage
  COLD = 'cold'    // Rarely accessed, archive storage
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  threshold?: number; // Similarity threshold (0-1)
  filterByTier?: StorageTier[];
  filterByType?: string[];
  dateRange?: { from?: Date; to?: Date };
}

export interface ListFilters {
  tier?: StorageTier;
  type?: string;
  fromDate?: Date;
  toDate?: Date;
  tags?: string[];
  includeDeleted?: boolean;
}

export interface AuditLog {
  id: string;
  agentId: string;
  action: string;
  fileId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

// ClawBus interface for notifications
interface ClawBus {
  notify(agentId: string, event: string, payload: any): Promise<void>;
}

// Configuration
interface ClawFSConfig {
  supabaseUrl: string;
  supabaseKey: string;
  hotTierDays: number;
  warmTierDays: number;
  embeddingDimension: number;
  clawBus?: ClawBus;
}

export class ClawFSError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ClawFSError';
  }
}

/**
 * ClawFS Service - Core file operations for agents
 */
export class ClawFSService {
  private supabase: SupabaseClient;
  private config: ClawFSConfig;
  private clawBus?: ClawBus;

  constructor(config: ClawFSConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.clawBus = config.clawBus;
  }

  /**
   * Generate content identifier (CID) using SHA-256
   */
  private generateCID(content: string | Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(typeof content === 'string' ? content : content.toString());
    return 'cid_' + hash.digest('hex');
  }

  /**
   * Generate embedding for semantic search (placeholder - integrate with actual embedding service)
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    // This is a placeholder. In production, use OpenAI, Cohere, or similar
    // For now, return a zero vector of the configured dimension
    return new Array(this.config.embeddingDimension || 1536).fill(0);
  }

  /**
   * Calculate similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Determine storage tier based on access patterns
   */
  private determineStorageTier(): StorageTier {
    // Default to warm tier for new files
    // In production, this could use ML models to predict access patterns
    return StorageTier.WARM;
  }

  /**
   * Log audit event
   */
  private async logAudit(
    agentId: string,
    action: string,
    fileId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const log: Partial<AuditLog> = {
        id: uuidv4(),
        agentId,
        action,
        fileId,
        details: details || {},
        timestamp: new Date()
      };

      await this.supabase.from('audit_logs').insert(log);
    } catch (error) {
      // Audit logging should not fail the operation
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Verify agent has permission for an action
   */
  private async verifyPermission(
    agentId: string,
    fileId: string,
    requiredPermission: 'read' | 'write' | 'delete' | 'share'
  ): Promise<boolean> {
    // Check if agent is owner
    const { data: file, error } = await this.supabase
      .from('files')
      .select('owner_id, permissions')
      .eq('id', fileId)
      .single();

    if (error || !file) {
      throw new ClawFSError('File not found', 'FILE_NOT_FOUND', { fileId });
    }

    if (file.owner_id === agentId) return true;

    // Check explicit permissions
    const permissions: Permission[] = file.permissions || [];
    const agentPermission = permissions.find(p => p.agentId === agentId);

    if (!agentPermission) return false;

    switch (requiredPermission) {
      case 'read':
        return agentPermission.canRead;
      case 'write':
        return agentPermission.canWrite;
      case 'delete':
        return agentPermission.canDelete;
      case 'share':
        return agentPermission.canShare;
      default:
        return false;
    }
  }

  /**
   * 1. STORE - Store a new file
   */
  async store(
    agentId: string,
    content: string | Buffer,
    metadata: Partial<FileMetadata>,
    permissions?: Partial<Permission>[]
  ): Promise<FileObject> {
    try {
      // Generate CID
      const cid = this.generateCID(content);

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(
        typeof content === 'string' ? content : content.toString()
      );

      // Determine storage tier
      const storageTier = this.determineStorageTier();

      // Create file object
      const now = new Date();
      const file: Partial<FileObject> = {
        id: uuidv4(),
        cid,
        ownerId: agentId,
        content,
        metadata: {
          name: metadata.name || 'unnamed',
          mimeType: metadata.mimeType || 'application/octet-stream',
          size: metadata.size || Buffer.byteLength(content),
          tags: metadata.tags || [],
          description: metadata.description,
          embedding
        },
        permissions: permissions?.map(p => ({
          agentId: p.agentId || '',
          canRead: p.canRead ?? true,
          canWrite: p.canWrite ?? false,
          canDelete: p.canDelete ?? false,
          canShare: p.canShare ?? false,
          grantedAt: now,
          grantedBy: agentId
        })) || [],
        version: 1,
        storageTier,
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now
      };

      // Store in Supabase
      const { error: insertError } = await this.supabase.from('files').insert({
        id: file.id,
        cid: file.cid,
        owner_id: file.ownerId,
        content: file.content,
        metadata: file.metadata,
        permissions: file.permissions,
        version: file.version,
        storage_tier: file.storageTier,
        created_at: file.createdAt,
        updated_at: file.updatedAt,
        last_accessed_at: file.lastAccessedAt
      });

      if (insertError) {
        throw new ClawFSError(
          'Failed to store file',
          'STORAGE_ERROR',
          { cause: insertError }
        );
      }

      // Log audit
      await this.logAudit(agentId, 'STORE', file.id, {
        cid,
        size: file.metadata?.size,
        tier: storageTier
      });

      return file as FileObject;
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error storing file',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 2. RETRIEVE - Fetch a file by ID
   */
  async retrieve(agentId: string, fileId: string): Promise<FileObject> {
    try {
      // Verify read permission
      const hasPermission = await this.verifyPermission(agentId, fileId, 'read');
      if (!hasPermission) {
        throw new ClawFSError(
          'Access denied',
          'PERMISSION_DENIED',
          { agentId, fileId, action: 'read' }
        );
      }

      // Fetch file
      const { data: file, error } = await this.supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .is('deleted_at', null)
        .single();

      if (error || !file) {
        throw new ClawFSError('File not found', 'FILE_NOT_FOUND', { fileId });
      }

      // Update last accessed time
      await this.supabase
        .from('files')
        .update({ last_accessed_at: new Date() })
        .eq('id', fileId);

      // Log access
      await this.logAudit(agentId, 'RETRIEVE', fileId, {
        tier: file.storage_tier,
        cid: file.cid
      });

      return {
        id: file.id,
        cid: file.cid,
        ownerId: file.owner_id,
        content: file.content,
        metadata: file.metadata,
        permissions: file.permissions,
        version: file.version,
        parentId: file.parent_id,
        storageTier: file.storage_tier,
        createdAt: new Date(file.created_at),
        updatedAt: new Date(file.updated_at),
        lastAccessedAt: new Date()
      } as FileObject;
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error retrieving file',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 3. SHARE - Share a file with another agent
   */
  async share(
    ownerId: string,
    fileId: string,
    targetAgentId: string,
    permissions: Partial<Permission>
  ): Promise<AccessPolicy> {
    try {
      // Verify owner has share permission
      const hasPermission = await this.verifyPermission(ownerId, fileId, 'share');
      if (!hasPermission) {
        throw new ClawFSError(
          'Access denied - cannot share this file',
          'PERMISSION_DENIED',
          { ownerId, fileId }
        );
      }

      // Get current file
      const { data: file, error } = await this.supabase
        .from('files')
        .select('owner_id, permissions')
        .eq('id', fileId)
        .single();

      if (error || !file) {
        throw new ClawFSError('File not found', 'FILE_NOT_FOUND', { fileId });
      }

      if (file.owner_id !== ownerId) {
        throw new ClawFSError(
          'Only owner can share',
          'NOT_OWNER',
          { ownerId, actualOwner: file.owner_id }
        );
      }

      // Create new permission
      const newPermission: Permission = {
        agentId: targetAgentId,
        canRead: permissions.canRead ?? true,
        canWrite: permissions.canWrite ?? false,
        canDelete: permissions.canDelete ?? false,
        canShare: permissions.canShare ?? false,
        grantedAt: new Date(),
        grantedBy: ownerId
      };

      // Update permissions array
      const currentPermissions: Permission[] = file.permissions || [];
      const existingIndex = currentPermissions.findIndex(
        p => p.agentId === targetAgentId
      );

      if (existingIndex >= 0) {
        currentPermissions[existingIndex] = newPermission;
      } else {
        currentPermissions.push(newPermission);
      }

      // Save to database
      const { error: updateError } = await this.supabase
        .from('files')
        .update({ permissions: currentPermissions })
        .eq('id', fileId);

      if (updateError) {
        throw new ClawFSError(
          'Failed to update permissions',
          'STORAGE_ERROR',
          { cause: updateError }
        );
      }

      // Log audit
      await this.logAudit(ownerId, 'SHARE', fileId, {
        targetAgentId,
        permissions: newPermission
      });

      // Notify target agent via ClawBus if available
      if (this.clawBus) {
        try {
          await this.clawBus.notify(targetAgentId, 'FILE_SHARED', {
            fileId,
            sharedBy: ownerId,
            permissions: newPermission
          });
        } catch (notifyError) {
          // Notification failure shouldn't break the share
          console.error('Failed to notify agent:', notifyError);
        }
      }

      return {
        fileId,
        ownerId,
        permissions: currentPermissions,
        isPublic: false
      };
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error sharing file',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 4. UPDATE - Update file content (creates new version)
   */
  async update(
    agentId: string,
    fileId: string,
    newContent: string | Buffer,
    expectedVersion?: number
  ): Promise<FileVersion> {
    try {
      // Verify write permission
      const hasPermission = await this.verifyPermission(agentId, fileId, 'write');
      if (!hasPermission) {
        throw new ClawFSError(
          'Access denied - cannot modify this file',
          'PERMISSION_DENIED',
          { agentId, fileId }
        );
      }

      // Get current file with optimistic locking
      const { data: file, error } = await this.supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .is('deleted_at', null)
        .single();

      if (error || !file) {
        throw new ClawFSError('File not found', 'FILE_NOT_FOUND', { fileId });
      }

      // Optimistic locking
      if (expectedVersion !== undefined && file.version !== expectedVersion) {
        throw new ClawFSError(
          'Version conflict - file was modified',
          'VERSION_CONFLICT',
          { expected: expectedVersion, actual: file.version }
        );
      }

      // Generate new CID and embedding
      const newCid = this.generateCID(newContent);
      const newEmbedding = await this.generateEmbedding(
        typeof newContent === 'string' ? newContent : newContent.toString()
      );

      const now = new Date();
      const newVersion = file.version + 1;

      // Create version record
      const versionRecord: Partial<FileVersion> = {
        id: uuidv4(),
        fileId,
        version: newVersion,
        cid: newCid,
        createdAt: now,
        createdBy: agentId
      };

      // Store version in versions table
      await this.supabase.from('file_versions').insert({
        id: versionRecord.id,
        file_id: fileId,
        version: newVersion,
        cid: newCid,
        content: newContent,
        created_at: now,
        created_by: agentId,
        parent_id: file.cid
      });

      // Update main file record
      const updatedMetadata = {
        ...file.metadata,
        embedding: newEmbedding,
        size: Buffer.byteLength(newContent)
      };

      const { error: updateError } = await this.supabase
        .from('files')
        .update({
          cid: newCid,
          content: newContent,
          metadata: updatedMetadata,
          version: newVersion,
          updated_at: now,
          last_accessed_at: now
        })
        .eq('id', fileId);

      if (updateError) {
        throw new ClawFSError(
          'Failed to update file',
          'STORAGE_ERROR',
          { cause: updateError }
        );
      }

      // Log audit
      await this.logAudit(agentId, 'UPDATE', fileId, {
        previousVersion: file.version,
        newVersion,
        previousCid: file.cid,
        newCid
      });

      return versionRecord as FileVersion;
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error updating file',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 5. SEARCH - Semantic search across files
   */
  async search(
    agentId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<FileObject[]> {
    try {
      const {
        limit = 10,
        offset = 0,
        threshold = 0.7,
        filterByTier,
        filterByType,
        dateRange
      } = options;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Build base query
      let dbQuery = this.supabase
        .from('files')
        .select('*')
        .is('deleted_at', null);

      // Apply filters
      if (filterByTier?.length) {
        dbQuery = dbQuery.in('storage_tier', filterByTier);
      }

      if (dateRange?.from) {
        dbQuery = dbQuery.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        dbQuery = dbQuery.lte('created_at', dateRange.to.toISOString());
      }

      // Execute query
      const { data: files, error } = await dbQuery;

      if (error) {
        throw new ClawFSError(
          'Search query failed',
          'SEARCH_ERROR',
          { cause: error }
        );
      }

      if (!files?.length) return [];

      // Filter by permissions and calculate similarity
      const results: Array<{ file: any; similarity: number }> = [];

      for (const file of files) {
        // Check permission
        const isOwner = file.owner_id === agentId;
        const hasExplicitPermission = (file.permissions || []).some(
          (p: Permission) => p.agentId === agentId && p.canRead
        );

        if (!isOwner && !hasExplicitPermission) continue;

        // Calculate semantic similarity
        const fileEmbedding = file.metadata?.embedding;
        let similarity = 0;

        if (fileEmbedding && Array.isArray(fileEmbedding)) {
          similarity = this.cosineSimilarity(queryEmbedding, fileEmbedding);
        }

        // Also check text match in name/tags/description
        const searchText = [
          file.metadata?.name || '',
          ...(file.metadata?.tags || []),
          file.metadata?.description || ''
        ].join(' ').toLowerCase();

        const queryLower = query.toLowerCase();
        const textMatch = searchText.includes(queryLower);

        // Boost similarity for text matches
        if (textMatch) similarity = Math.max(similarity, 0.5);

        if (similarity >= threshold || textMatch) {
          results.push({ file, similarity });
        }
      }

      // Sort by similarity (descending) and apply pagination
      results.sort((a, b) => b.similarity - a.similarity);

      const paginated = results.slice(offset, offset + limit);

      // Log audit
      await this.logAudit(agentId, 'SEARCH', undefined, {
        query,
        resultsCount: paginated.length,
        threshold
      });

      return paginated.map(r => ({
        id: r.file.id,
        cid: r.file.cid,
        ownerId: r.file.owner_id,
        content: r.file.content,
        metadata: r.file.metadata,
        permissions: r.file.permissions,
        version: r.file.version,
        parentId: r.file.parent_id,
        storageTier: r.file.storage_tier,
        createdAt: new Date(r.file.created_at),
        updatedAt: new Date(r.file.updated_at),
        lastAccessedAt: new Date(r.file.last_accessed_at)
      })) as FileObject[];
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error searching files',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 6. DELETE - Soft delete a file
   */
  async delete(agentId: string, fileId: string): Promise<boolean> {
    try {
      // Verify delete permission
      const hasPermission = await this.verifyPermission(agentId, fileId, 'delete');
      if (!hasPermission) {
        throw new ClawFSError(
          'Access denied - cannot delete this file',
          'PERMISSION_DENIED',
          { agentId, fileId }
        );
      }

      // Get file for logging
      const { data: file, error } = await this.supabase
        .from('files')
        .select('owner_id, storage_tier')
        .eq('id', fileId)
        .single();

      if (error || !file) {
        throw new ClawFSError('File not found', 'FILE_NOT_FOUND', { fileId });
      }

      // Soft delete
      const now = new Date();
      const { error: updateError } = await this.supabase
        .from('files')
        .update({
          deleted_at: now,
          updated_at: now
        })
        .eq('id', fileId);

      if (updateError) {
        throw new ClawFSError(
          'Failed to delete file',
          'STORAGE_ERROR',
          { cause: updateError }
        );
      }

      // Schedule cold tier cleanup (in production, this would queue a background job)
      if (file.storage_tier !== StorageTier.COLD) {
        await this.scheduleColdTierCleanup(fileId);
      }

      // Log audit
      await this.logAudit(agentId, 'DELETE', fileId, {
        softDelete: true,
        previousTier: file.storage_tier
      });

      return true;
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error deleting file',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Schedule cold tier cleanup (placeholder for background job system)
   */
  private async scheduleColdTierCleanup(fileId: string): Promise<void> {
    // In production, this would queue a job to move to cold storage
    console.log(`Scheduled cold tier cleanup for file ${fileId}`);
  }

  /**
   * 7. LIST - List files with filters
   */
  async list(agentId: string, filters: ListFilters = {}): Promise<FileObject[]> {
    try {
      const {
        tier,
        type,
        fromDate,
        toDate,
        tags,
        includeDeleted = false
      } = filters;

      // Build query for files agent owns or has access to
      let dbQuery = this.supabase
        .from('files')
        .select('*');

      if (!includeDeleted) {
        dbQuery = dbQuery.is('deleted_at', null);
      }

      // Apply filters
      if (tier) {
        dbQuery = dbQuery.eq('storage_tier', tier);
      }

      if (fromDate) {
        dbQuery = dbQuery.gte('created_at', fromDate.toISOString());
      }

      if (toDate) {
        dbQuery = dbQuery.lte('created_at', toDate.toISOString());
      }

      // Execute query
      const { data: files, error } = await dbQuery;

      if (error) {
        throw new ClawFSError(
          'List query failed',
          'LIST_ERROR',
          { cause: error }
        );
      }

      if (!files?.length) return [];

      // Filter by permissions and additional criteria
      const results: any[] = [];

      for (const file of files) {
        // Check ownership or permission
        const isOwner = file.owner_id === agentId;
        const hasPermission = (file.permissions || []).some(
          (p: Permission) => p.agentId === agentId && p.canRead
        );

        if (!isOwner && !hasPermission) continue;

        // Filter by type (mime type check)
        if (type && !file.metadata?.mimeType?.startsWith(type)) {
          continue;
        }

        // Filter by tags
        if (tags?.length) {
          const fileTags = file.metadata?.tags || [];
          const hasAllTags = tags.every(t => fileTags.includes(t));
          if (!hasAllTags) continue;
        }

        results.push(file);
      }

      // Log audit
      await this.logAudit(agentId, 'LIST', undefined, {
        filters,
        resultsCount: results.length
      });

      return results.map(file => ({
        id: file.id,
        cid: file.cid,
        ownerId: file.owner_id,
        content: file.content,
        metadata: file.metadata,
        permissions: file.permissions,
        version: file.version,
        parentId: file.parent_id,
        storageTier: file.storage_tier,
        createdAt: new Date(file.created_at),
        updatedAt: new Date(file.updated_at),
        lastAccessedAt: new Date(file.last_accessed_at),
        deletedAt: file.deleted_at ? new Date(file.deleted_at) : undefined
      })) as FileObject[];
    } catch (error) {
      if (error instanceof ClawFSError) throw error;
      throw new ClawFSError(
        'Unexpected error listing files',
        'INTERNAL_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * 8. MIGRATE TIERS - Background tier migration based on access patterns
   */
  async migrateTiers(): Promise<void> {
    try {
      const now = new Date();
      const hotThreshold = new Date(
        now.getTime() - (this.config.hotTierDays || 7) * 24 * 60 * 60 * 1000
      );
      const warmThreshold = new Date(
        now.getTime() - (this.config.warmTierDays || 30) * 24 * 60 * 60 * 1000
      );

      // Files to demote from HOT to WARM
      const { data: hotToWarm } = await this.supabase
        .from('files')
        .select('id, last_accessed_at')
        .eq('storage_tier', StorageTier.HOT)
        .lt('last_accessed_at', hotThreshold.toISOString())
        .is('deleted_at', null);

      // Files to demote from WARM to COLD
      const { data: warmToCold } = await this.supabase
        .from('files')
        .select('id, last_accessed_at')
        .eq('storage_tier', StorageTier.WARM)
        .lt('last_accessed_at', warmThreshold.toISOString())
        .is('deleted_at', null);

      // Files to promote from WARM to HOT (recently accessed)
      const { data: warmToHot } = await this.supabase
        .from('files')
        .select('id, last_accessed_at')
        .eq('storage_tier', StorageTier.WARM)
        .gte('last_accessed_at', hotThreshold.toISOString())
        .is('deleted_at', null);

      // Apply migrations
      const migrations: Array<{ ids: string[]; tier: StorageTier }> = [
        { ids: hotToWarm?.map(f => f.id) || [], tier: StorageTier.WARM },
        { ids: warmToCold?.map(f => f.id) || [], tier: StorageTier.COLD },
        { ids: warmToHot?.map(f => f.id) || [], tier: StorageTier.HOT }
      ];

      for (const migration of migrations) {
        if (migration.ids.length > 0) {
          await this.supabase
            .from('files')
            .update({ storage_tier: migration.tier })
            .in('id', migration.ids);

          console.log(
            `Migrated ${migration.ids.length} files to ${migration.tier} tier`
          );
        }
      }

      // Log audit
      await this.logAudit('system', 'MIGRATE_TIERS', undefined, {
        hotToWarm: hotToWarm?.length || 0,
        warmToCold: warmToCold?.length || 0,
        warmToHot: warmToHot?.length || 0
      });
    } catch (error) {
      console.error('Tier migration failed:', error);
      throw new ClawFSError(
        'Tier migration failed',
        'MIGRATION_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Get file version history
   */
  async getVersionHistory(
    agentId: string,
    fileId: string
  ): Promise<FileVersion[]> {
    // Verify read permission
    const hasPermission = await this.verifyPermission(agentId, fileId, 'read');
    if (!hasPermission) {
      throw new ClawFSError(
        'Access denied',
        'PERMISSION_DENIED',
        { agentId, fileId, action: 'read_history' }
      );
    }

    const { data: versions, error } = await this.supabase
      .from('file_versions')
      .select('*')
      .eq('file_id', fileId)
      .order('version', { ascending: false });

    if (error) {
      throw new ClawFSError(
        'Failed to fetch version history',
        'STORAGE_ERROR',
        { cause: error }
      );
    }

    return (versions || []).map(v => ({
      id: v.id,
      fileId: v.file_id,
      version: v.version,
      cid: v.cid,
      createdAt: new Date(v.created_at),
      createdBy: v.created_by,
      changeSummary: v.change_summary
    })) as FileVersion[];
  }

  /**
   * Restore a file from a specific version
   */
  async restoreVersion(
    agentId: string,
    fileId: string,
    versionId: string
  ): Promise<FileVersion> {
    // Get version
    const { data: version, error: versionError } = await this.supabase
      .from('file_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      throw new ClawFSError(
        'Version not found',
        'VERSION_NOT_FOUND',
        { versionId }
      );
    }

    // Use update to create new version with old content
    return this.update(agentId, fileId, version.content);
  }
}

// Export default instance factory
export function createClawFSService(config: ClawFSConfig): ClawFSService {
  return new ClawFSService(config);
}

export default ClawFSService;
