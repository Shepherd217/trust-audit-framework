/**
 * ============================================================================
 * ClawFS - Content-Addressed Distributed File System
 * ============================================================================
 * 
 * Type definitions for the distributed storage system.
 * This is "IPFS + S3 for Agents" - content-addressed, tiered storage
 * with agent-based access control.
 * 
 * @module lib/claw/fs/types
 * @version 1.0.0
 */

// ============================================================================
// Core File Types
// ============================================================================

/** Storage tier for file management */
export type StorageTier = 'hot' | 'warm' | 'cold';

/** Storage location types for distributed file placement */
export type StorageLocationType = 'local' | 's3' | 'supabase';

/** Storage location definition */
export interface StorageLocation {
  type: StorageLocationType;
  /** Primary storage: Supabase Storage */
  bucket: string;
  path: string;
  /** S3 specific fields (optional) */
  key?: string;
  /** Local cache path (optional) */
  localPath?: string;
}

/** Access control configuration */
export interface AccessControl {
  /** Agent ID that owns this file */
  owner: string;
  /** Agent IDs with read access (includes owner) */
  readAccess: string[];
  /** Agent IDs with write access (rarely used for immutable files) */
  writeAccess: string[];
}

/** Permission record for file access */
export interface Permission {
  agentId: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

/** File metadata */
export interface FileMetadata {
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Searchable tags */
  tags: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp (optional) */
  expiresAt?: Date;
}

/** Core ClawFile entity - immutable once created */
export interface ClawFile {
  /** Content Identifier - SHA-256 hash of content */
  cid: string;
  /** Size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Storage locations (primary + replicas) */
  locations: StorageLocation[];
  /** Access control rules */
  accessControl: AccessControl;
  /** Metadata */
  metadata: FileMetadata;
  /** Storage tier */
  tier: StorageTier;
}

// ============================================================================
// Input Types
// ============================================================================

/** Input for writing a file */
export interface WriteFileInput {
  /** Display name */
  name: string;
  /** File content */
  data: Buffer | string;
  /** MIME type (auto-detected if not provided) */
  mimeType?: string;
  /** Storage tier (default: 'warm') */
  tier?: StorageTier;
  /** Agent IDs to share read access with */
  shareWith?: string[];
  /** Expiration duration string: '1d', '7d', '30d', '90d', '1y' */
  expiresIn?: string;
  /** Searchable tags */
  tags?: string[];
  /** Optional description */
  description?: string;
}

/** Input for querying files */
export interface QueryFilesInput {
  /** Filter by owner agent ID */
  owner?: string;
  /** Filter by tags (must have all specified tags) */
  tags?: string[];
  /** Filter by creation date after */
  createdAfter?: Date;
  /** Filter by creation date before */
  createdBefore?: Date;
  /** Filter by CID prefix */
  cidPrefix?: string;
  /** Filter by storage tier */
  tier?: StorageTier;
  /** Search in name/description */
  search?: string;
  /** Maximum results (default: 100) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// ============================================================================
// API Types
// ============================================================================

/** Upload response */
export interface UploadResponse {
  success: boolean;
  file: ClawFileDTO;
}

/** Download response (metadata only, actual data streamed) */
export interface DownloadResponse {
  success: boolean;
  cid: string;
  mimeType: string;
  size: number;
  name: string;
}

/** Metadata response */
export interface MetadataResponse {
  success: boolean;
  file: ClawFileDTO;
}

/** List response */
export interface ListResponse {
  success: boolean;
  files: ClawFileDTO[];
  total: number;
  hasMore: boolean;
}

/** Share/Revoke response */
export interface PermissionResponse {
  success: boolean;
  cid: string;
  action: 'share' | 'revoke';
  affectedAgents: string[];
}

/** Delete response */
export interface DeleteResponse {
  success: boolean;
  cid: string;
}

/** Error response */
export interface ErrorResponse {
  success: false;
  error: string;
  code: ClawFSErrorCode;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/** ClawFile DTO for API responses */
export interface ClawFileDTO {
  cid: string;
  size: number;
  mimeType: string;
  locations: StorageLocation[];
  owner: string;
  readAccess: string[];
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  expiresAt?: string;
  tier: StorageTier;
}

/** Convert ClawFile to DTO */
export function toClawFileDTO(file: ClawFile): ClawFileDTO {
  return {
    cid: file.cid,
    size: file.size,
    mimeType: file.mimeType,
    locations: file.locations,
    owner: file.accessControl.owner,
    readAccess: file.accessControl.readAccess,
    name: file.metadata.name,
    description: file.metadata.description,
    tags: file.metadata.tags,
    createdAt: file.metadata.createdAt.toISOString(),
    expiresAt: file.metadata.expiresAt?.toISOString(),
    tier: file.tier,
  };
}

// ============================================================================
// Error Types
// ============================================================================

/** ClawFS error codes */
export type ClawFSErrorCode =
  | 'FILE_NOT_FOUND'
  | 'CID_MISMATCH'
  | 'ACCESS_DENIED'
  | 'INVALID_INPUT'
  | 'STORAGE_ERROR'
  | 'REPLICATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'EXPIRED'
  | 'ALREADY_EXISTS'
  | 'INVALID_TIER'
  | 'INTERNAL_ERROR';

/** ClawFS error class */
export class ClawFSError extends Error {
  constructor(
    message: string,
    public readonly code: ClawFSErrorCode,
    public readonly cid?: string
  ) {
    super(message);
    this.name = 'ClawFSError';
  }
}

// ============================================================================
// Internal Types
// ============================================================================

/** Database record for claw_files table */
export interface ClawFileRecord {
  id: string; // UUID
  cid: string;
  owner: string;
  size: number;
  mime_type: string;
  locations: StorageLocation[];
  read_access: string[];
  write_access: string[];
  name: string;
  description?: string;
  tags: string[];
  created_at: string;
  expires_at?: string;
  tier: StorageTier;
}

/** Local cache entry for hot files */
export interface CacheEntry {
  cid: string;
  path: string;
  size: number;
  accessedAt: Date;
  accessCount: number;
}

/** Replication task for background processing */
export interface ReplicationTask {
  cid: string;
  targetLocations: StorageLocation[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Tier configuration */
export interface TierConfig {
  /** Max size for hot storage (MB) */
  hotMaxSizeMB: number;
  /** Local cache size limit (MB) */
  cacheSizeMB: number;
  /** Auto-tier down after days */
  autoTierDownDays: number;
}

/** Default tier configuration */
export const DEFAULT_TIER_CONFIG: TierConfig = {
  hotMaxSizeMB: 100,
  cacheSizeMB: 1000,
  autoTierDownDays: 30,
};

/** Parse expiresIn string to duration in milliseconds */
export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([dmy])$/);
  if (!match) {
    throw new ClawFSError('Invalid expiresIn format. Use: 1d, 7d, 30d, 90d, 1y', 'INVALID_INPUT');
  }
  
  const [, value, unit] = match;
  const numValue = parseInt(value, 10);
  
  switch (unit) {
    case 'd': return numValue * 24 * 60 * 60 * 1000;
    case 'm': return numValue * 30 * 24 * 60 * 60 * 1000;
    case 'y': return numValue * 365 * 24 * 60 * 60 * 1000;
    default: throw new ClawFSError('Invalid expiresIn unit. Use: d, m, y', 'INVALID_INPUT');
  }
}

/** Calculate expiration date from string */
export function calculateExpiresAt(expiresIn: string): Date {
  const duration = parseExpiresIn(expiresIn);
  return new Date(Date.now() + duration);
}

/** Detect MIME type from filename or content */
export function detectMimeType(filename: string, content?: Buffer): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'webm': 'video/webm',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'md': 'text/markdown',
    'csv': 'text/csv',
    'xml': 'application/xml',
    'yaml': 'application/yaml',
    'yml': 'application/yaml',
  };
  
  if (ext && mimeTypes[ext]) {
    return mimeTypes[ext];
  }
  
  // Try to detect from content
  if (content) {
    if (content.slice(0, 4).toString('hex') === '89504e47') return 'image/png';
    if (content.slice(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg';
    if (content.slice(0, 4).toString() === '%PDF') return 'application/pdf';
    if (content.slice(0, 5).toString() === '<?xml') return 'application/xml';
  }
  
  return 'application/octet-stream';
}
