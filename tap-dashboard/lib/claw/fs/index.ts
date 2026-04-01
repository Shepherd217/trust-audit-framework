/**
 * ============================================================================
 * ClawFS - Content-Addressed Distributed File System
 * ============================================================================
 * 
 * Core service implementation for the distributed storage system.
 * 
 * Features:
 * - Content-addressed storage (CID = SHA-256 hash)
 * - Tiered storage (hot/warm/cold)
 * - Agent-based access control
 * - Supabase Storage as primary backend
 * - Local caching for hot files
 * - Automatic expiration
 * 
 * @module lib/claw/fs
 * @version 1.0.0
 */

import { createHash } from 'crypto';
import { writeFile, readFile, unlink, mkdir, access, constants } from 'fs/promises';
import { join, resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ClawFile,
  ClawFileRecord,
  WriteFileInput,
  QueryFilesInput,
  StorageLocation,
  StorageTier,
  CacheEntry,
  ClawFSError,
  toClawFileDTO,
  calculateExpiresAt,
  detectMimeType,
  DEFAULT_TIER_CONFIG,
  TierConfig,
} from './types';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// ============================================================================
// Configuration
// ============================================================================

/** Local cache directory for hot files */
const CACHE_DIR = process.env.CLAWFS_CACHE_DIR || '/tmp/clawfs/cache';

/** Supabase storage bucket name */
const STORAGE_BUCKET = process.env.CLAWFS_BUCKET || 'clawfs';

/** Max file size (100MB default) */
const MAX_FILE_SIZE = parseInt(process.env.CLAWFS_MAX_SIZE || '104857600', 10);

// ============================================================================
// Supabase Client
// ============================================================================

let supabaseClient: SupabaseClient<ExtendedDatabase> | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new ClawFSError(
        'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
        'INTERNAL_ERROR'
      );
    }
    
    supabaseClient = createTypedClient(url, key);
  }
  return supabaseClient;
}

// ============================================================================
// Cache Management
// ============================================================================

/** In-memory cache index */
const cacheIndex = new Map<string, CacheEntry>();

/** Initialize cache directory */
async function initCache(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await cleanupCache();
  } catch (error) {
    console.error('Failed to initialize cache:', error);
  }
}

/** Get cache path for a CID */
function getCachePath(cid: string): string {
  // Use first 2 chars as subdirectory to avoid too many files in one dir
  return join(CACHE_DIR, cid.slice(0, 2), cid);
}

/** Check if file is cached locally */
async function isCached(cid: string): Promise<boolean> {
  const entry = cacheIndex.get(cid);
  if (!entry) return false;
  
  try {
    await access(entry.path, constants.F_OK);
    return true;
  } catch {
    cacheIndex.delete(cid);
    return false;
  }
}

/** Cache file locally */
async function cacheFile(cid: string, data: Buffer, tier: StorageTier): Promise<void> {
  if (tier !== 'hot') return; // Only cache hot files
  
  const cachePath = getCachePath(cid);
  const cacheDir = join(cachePath, '..');
  
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, data);
    
    cacheIndex.set(cid, {
      cid,
      path: cachePath,
      size: data.length,
      accessedAt: new Date(),
      accessCount: 1,
    });
    
    // Enforce cache size limit
    await enforceCacheLimit();
  } catch (error) {
    console.error('Failed to cache file:', error);
  }
}

/** Enforce cache size limit (LRU eviction) */
async function enforceCacheLimit(): Promise<void> {
  const config = DEFAULT_TIER_CONFIG;
  const maxSize = config.cacheSizeMB * 1024 * 1024;
  
  let totalSize = 0;
  const entries: CacheEntry[] = [];
  
  for (const entry of cacheIndex.values()) {
    totalSize += entry.size;
    entries.push(entry);
  }
  
  if (totalSize <= maxSize) return;
  
  // Sort by last accessed (oldest first)
  entries.sort((a, b) => a.accessedAt.getTime() - b.accessedAt.getTime());
  
  for (const entry of entries) {
    if (totalSize <= maxSize * 0.8) break; // Target 80% of limit
    
    try {
      await unlink(entry.path);
      cacheIndex.delete(entry.cid);
      totalSize -= entry.size;
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/** Clean up expired cache entries */
async function cleanupCache(): Promise<void> {
  // This could scan the cache directory for stale files
  // For now, just ensure the directory exists
}

// Initialize cache on module load
initCache();

// ============================================================================
// CID Generation
// ============================================================================

/** Calculate CID from content (SHA-256) */
export function calculateCID(data: Buffer | string): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/** Validate CID format */
export function isValidCID(cid: string): boolean {
  return /^[a-f0-9]{64}$/i.test(cid);
}

// ============================================================================
// Access Control
// ============================================================================

/** Check if requester has read access */
function canRead(file: ClawFile, requesterId: string): boolean {
  if (file.accessControl.owner === requesterId) return true;
  if (file.accessControl.readAccess.includes(requesterId)) return true;
  return false;
}

/** Check if requester has write access */
function canWrite(file: ClawFile, requesterId: string): boolean {
  if (file.accessControl.owner === requesterId) return true;
  if (file.accessControl.writeAccess.includes(requesterId)) return true;
  return false;
}

/** Check if file is expired */
function isExpired(file: ClawFile): boolean {
  if (!file.metadata.expiresAt) return false;
  return new Date() > file.metadata.expiresAt;
}

// ============================================================================
// Database Operations
// ============================================================================

/** Convert database record to ClawFile */
function recordToClawFile(record: ClawFileRecord): ClawFile {
  return {
    cid: record.cid,
    size: record.size,
    mimeType: record.mime_type,
    locations: record.locations,
    accessControl: {
      owner: record.owner,
      readAccess: record.read_access,
      writeAccess: record.write_access,
    },
    metadata: {
      name: record.name,
      description: record.description,
      tags: record.tags,
      createdAt: new Date(record.created_at),
      expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
    },
    tier: record.tier,
  };
}

/** Convert ClawFile to database record */
function clawFileToRecord(file: ClawFile): Omit<ClawFileRecord, 'id'> {
  return {
    cid: file.cid,
    owner: file.accessControl.owner,
    size: file.size,
    mime_type: file.mimeType,
    locations: file.locations,
    read_access: file.accessControl.readAccess,
    write_access: file.accessControl.writeAccess,
    name: file.metadata.name,
    description: file.metadata.description,
    tags: file.metadata.tags,
    created_at: file.metadata.createdAt.toISOString(),
    expires_at: file.metadata.expiresAt?.toISOString(),
    tier: file.tier,
  };
}

/** Get file record from database */
async function getFileRecord(cid: string): Promise<ClawFileRecord | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('claw_files')
    .select('*')
    .eq('cid', cid)
    .single();
  
  if (error || !data) return null;
  return data as ClawFileRecord;
}

/** Save file record to database */
async function saveFileRecord(file: ClawFile): Promise<void> {
  const supabase = getSupabase();
  const record = clawFileToRecord(file);
  
  const { error } = await supabase
    .from('claw_files')
    .upsert(record, { onConflict: 'cid' });
  
  if (error) {
    throw new ClawFSError(
      `Failed to save file record: ${error.message}`,
      'STORAGE_ERROR'
    );
  }
}

/** Delete file record from database */
async function deleteFileRecord(cid: string): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('claw_files')
    .delete()
    .eq('cid', cid);
  
  if (error) {
    throw new ClawFSError(
      `Failed to delete file record: ${error.message}`,
      'STORAGE_ERROR'
    );
  }
}

// ============================================================================
// Storage Operations
// ============================================================================

/** Upload file to Supabase Storage */
async function uploadToStorage(cid: string, data: Buffer, mimeType: string): Promise<StorageLocation> {
  const supabase = getSupabase();
  const path = `${cid.slice(0, 2)}/${cid}`;
  
  const { error } = await supabase
    .storage
    .from(STORAGE_BUCKET)
    .upload(path, data, {
      contentType: mimeType,
      upsert: true,
    });
  
  if (error) {
    throw new ClawFSError(
      `Failed to upload to storage: ${error.message}`,
      'STORAGE_ERROR'
    );
  }
  
  return {
    type: 'supabase',
    bucket: STORAGE_BUCKET,
    path,
  };
}

/** Download file from Supabase Storage */
async function downloadFromStorage(location: StorageLocation): Promise<Buffer> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .storage
    .from(location.bucket)
    .download(location.path);
  
  if (error || !data) {
    throw new ClawFSError(
      `Failed to download from storage: ${error?.message || 'Unknown error'}`,
      'STORAGE_ERROR'
    );
  }
  
  return Buffer.from(await data.arrayBuffer());
}

/** Delete file from Supabase Storage */
async function deleteFromStorage(location: StorageLocation): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .storage
    .from(location.bucket)
    .remove([location.path]);
  
  if (error) {
    console.error('Failed to delete from storage:', error);
    // Don't throw - file might already be deleted
  }
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Write a file to ClawFS
 * @param input - File input
 * @param ownerId - Agent ID of the owner
 * @returns The created ClawFile
 */
export async function write(input: WriteFileInput, ownerId: string): Promise<ClawFile> {
  // Validate input
  if (!input.name || input.name.trim() === '') {
    throw new ClawFSError('File name is required', 'INVALID_INPUT');
  }
  
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data, 'utf-8');
  
  if (data.length === 0) {
    throw new ClawFSError('File data cannot be empty', 'INVALID_INPUT');
  }
  
  if (data.length > MAX_FILE_SIZE) {
    throw new ClawFSError(
      `File too large: ${data.length} bytes (max: ${MAX_FILE_SIZE})`,
      'FILE_TOO_LARGE'
    );
  }
  
  // Calculate CID
  const cid = calculateCID(data);
  
  // Check if file already exists
  const existing = await getFileRecord(cid);
  if (existing) {
    const existingFile = recordToClawFile(existing);
    // If owner is same, return existing file
    if (existingFile.accessControl.owner === ownerId) {
      return existingFile;
    }
    // Different owner, but same content - create new record with different access
  }
  
  // Determine MIME type
  const mimeType = input.mimeType || detectMimeType(input.name, data);
  
  // Determine tier
  const tier = input.tier || 'warm';
  if (!['hot', 'warm', 'cold'].includes(tier)) {
    throw new ClawFSError(`Invalid tier: ${tier}`, 'INVALID_TIER');
  }
  
  // Calculate expiration
  const expiresAt = input.expiresIn ? calculateExpiresAt(input.expiresIn) : undefined;
  
  // Build access control list
  const readAccess = [ownerId];
  if (input.shareWith) {
    for (const agentId of input.shareWith) {
      if (!readAccess.includes(agentId)) {
        readAccess.push(agentId);
      }
    }
  }
  
  // Upload to storage
  const location = await uploadToStorage(cid, data, mimeType);
  
  // Cache if hot tier
  if (tier === 'hot') {
    await cacheFile(cid, data, tier);
  }
  
  // Create ClawFile
  const file: ClawFile = {
    cid,
    size: data.length,
    mimeType,
    locations: [location],
    accessControl: {
      owner: ownerId,
      readAccess,
      writeAccess: [ownerId],
    },
    metadata: {
      name: input.name,
      description: input.description,
      tags: input.tags || [],
      createdAt: new Date(),
      expiresAt,
    },
    tier,
  };
  
  // Save to database
  await saveFileRecord(file);
  
  return file;
}

/**
 * Read a file from ClawFS
 * @param cid - Content identifier
 * @param requesterId - Agent ID requesting access
 * @returns File data as Buffer
 */
export async function read(cid: string, requesterId: string): Promise<Buffer> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  // Get file metadata
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  const file = recordToClawFile(record);
  
  // Check access
  if (!canRead(file, requesterId)) {
    throw new ClawFSError(`Access denied to file: ${cid}`, 'ACCESS_DENIED', cid);
  }
  
  // Check expiration
  if (isExpired(file)) {
    throw new ClawFSError(`File expired: ${cid}`, 'EXPIRED', cid);
  }
  
  // Try cache first for hot files
  if (file.tier === 'hot') {
    const cachePath = getCachePath(cid);
    try {
      const data = await readFile(cachePath);
      // Update access stats
      const entry = cacheIndex.get(cid);
      if (entry) {
        entry.accessedAt = new Date();
        entry.accessCount++;
      }
      return data;
    } catch {
      // Not in cache, continue to storage
    }
  }
  
  // Download from primary storage
  const primaryLocation = file.locations[0];
  if (!primaryLocation) {
    throw new ClawFSError(`No storage location for file: ${cid}`, 'STORAGE_ERROR', cid);
  }
  
  const data = await downloadFromStorage(primaryLocation);
  
  // Cache for hot tier
  if (file.tier === 'hot') {
    await cacheFile(cid, data, file.tier);
  }
  
  return data;
}

/**
 * Get file metadata
 * @param cid - Content identifier
 * @param requesterId - Agent ID requesting access
 * @returns File metadata
 */
export async function getMetadata(cid: string, requesterId: string): Promise<ClawFile> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  const file = recordToClawFile(record);
  
  if (!canRead(file, requesterId)) {
    throw new ClawFSError(`Access denied to file: ${cid}`, 'ACCESS_DENIED', cid);
  }
  
  return file;
}

/**
 * Share file with other agents
 * @param cid - Content identifier
 * @param ownerId - Owner agent ID (must be owner)
 * @param agentIds - Agent IDs to share with
 */
export async function share(cid: string, ownerId: string, agentIds: string[]): Promise<void> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  if (!agentIds || agentIds.length === 0) {
    throw new ClawFSError('No agents to share with', 'INVALID_INPUT');
  }
  
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  if (record.owner !== ownerId) {
    throw new ClawFSError(`Only owner can share file: ${cid}`, 'ACCESS_DENIED', cid);
  }
  
  // Update read access
  const currentAccess = new Set(record.read_access);
  for (const agentId of agentIds) {
    currentAccess.add(agentId);
  }
  
  const supabase = getSupabase();
  const { error } = await supabase
    .from('claw_files')
    .update({ read_access: Array.from(currentAccess) })
    .eq('cid', cid);
  
  if (error) {
    throw new ClawFSError(`Failed to share file: ${error.message}`, 'STORAGE_ERROR', cid);
  }
}

/**
 * Revoke access from agents
 * @param cid - Content identifier
 * @param ownerId - Owner agent ID (must be owner)
 * @param agentIds - Agent IDs to revoke access from
 */
export async function revoke(cid: string, ownerId: string, agentIds: string[]): Promise<void> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  if (!agentIds || agentIds.length === 0) {
    throw new ClawFSError('No agents to revoke from', 'INVALID_INPUT');
  }
  
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  if (record.owner !== ownerId) {
    throw new ClawFSError(`Only owner can revoke access: ${cid}`, 'ACCESS_DENIED', cid);
  }
  
  // Update read access (preserve owner)
  const currentAccess = new Set(record.read_access);
  for (const agentId of agentIds) {
    if (agentId !== ownerId) {
      currentAccess.delete(agentId);
    }
  }
  
  const supabase = getSupabase();
  const { error } = await supabase
    .from('claw_files')
    .update({ read_access: Array.from(currentAccess) })
    .eq('cid', cid);
  
  if (error) {
    throw new ClawFSError(`Failed to revoke access: ${error.message}`, 'STORAGE_ERROR', cid);
  }
}

/**
 * Query files with filters
 * @param input - Query parameters
 * @param requesterId - Agent ID making the request
 * @returns Matching files
 */
export async function query(input: QueryFilesInput, requesterId: string): Promise<ClawFile[]> {
  const supabase = getSupabase();
  
  let query = supabase.from('claw_files').select('*');
  
  // Filter by owner
  if (input.owner) {
    query = query.eq('owner', input.owner);
  }
  
  // Filter by tags (contains all specified tags)
  if (input.tags && input.tags.length > 0) {
    query = query.contains('tags', input.tags);
  }
  
  // Filter by creation date
  if (input.createdAfter) {
    query = query.gte('created_at', input.createdAfter.toISOString());
  }
  
  if (input.createdBefore) {
    query = query.lte('created_at', input.createdBefore.toISOString());
  }
  
  // Filter by CID prefix
  if (input.cidPrefix) {
    query = query.ilike('cid', `${input.cidPrefix}%`);
  }
  
  // Filter by tier
  if (input.tier) {
    query = query.eq('tier', input.tier);
  }
  
  // Apply access control: user can only see files they own or have read access to
  query = query.or(`owner.eq.${requesterId},read_access.cs.{${requesterId}}`);
  
  // Pagination
  const limit = input.limit || 100;
  const offset = input.offset || 0;
  query = query.range(offset, offset + limit - 1);
  
  // Order by creation date (newest first)
  query = query.order('created_at', { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    throw new ClawFSError(`Query failed: ${error.message}`, 'STORAGE_ERROR');
  }
  
  let files = (data as ClawFileRecord[]).map(recordToClawFile);
  
  // Post-filter by search term (name/description)
  if (input.search) {
    const searchLower = input.search.toLowerCase();
    files = files.filter(file => 
      file.metadata.name.toLowerCase().includes(searchLower) ||
      file.metadata.description?.toLowerCase().includes(searchLower) ||
      file.metadata.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }
  
  // Filter out expired files
  const now = new Date();
  files = files.filter(file => !file.metadata.expiresAt || file.metadata.expiresAt > now);
  
  return files;
}

/**
 * Delete a file
 * @param cid - Content identifier
 * @param ownerId - Owner agent ID (must be owner)
 */
export async function deleteFile(cid: string, ownerId: string): Promise<void> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  if (record.owner !== ownerId) {
    throw new ClawFSError(`Only owner can delete file: ${cid}`, 'ACCESS_DENIED', cid);
  }
  
  // Delete from all storage locations
  for (const location of record.locations) {
    await deleteFromStorage(location);
  }
  
  // Delete from cache if present
  const cachePath = getCachePath(cid);
  try {
    await unlink(cachePath);
    cacheIndex.delete(cid);
  } catch {
    // Not in cache, ignore
  }
  
  // Delete database record
  await deleteFileRecord(cid);
}

/**
 * Replicate file to additional locations
 * @param cid - Content identifier
 * @param locations - Additional storage locations
 */
export async function replicate(cid: string, locations: StorageLocation[]): Promise<void> {
  if (!isValidCID(cid)) {
    throw new ClawFSError(`Invalid CID: ${cid}`, 'INVALID_INPUT');
  }
  
  if (!locations || locations.length === 0) {
    throw new ClawFSError('No locations specified for replication', 'INVALID_INPUT');
  }
  
  const record = await getFileRecord(cid);
  if (!record) {
    throw new ClawFSError(`File not found: ${cid}`, 'FILE_NOT_FOUND', cid);
  }
  
  // Download from primary location
  const primaryLocation = record.locations[0];
  if (!primaryLocation) {
    throw new ClawFSError(`No primary location for file: ${cid}`, 'STORAGE_ERROR', cid);
  }
  
  const data = await downloadFromStorage(primaryLocation);
  
  // Verify CID
  const calculatedCID = calculateCID(data);
  if (calculatedCID !== cid) {
    throw new ClawFSError(`CID mismatch during replication`, 'CID_MISMATCH', cid);
  }
  
  // Upload to each new location (implementation depends on location type)
  // For now, only supabase type is supported
  const newLocations: StorageLocation[] = [];
  
  for (const location of locations) {
    if (location.type === 'supabase') {
      // Already handled by primary storage
      newLocations.push(location);
    } else if (location.type === 's3') {
      // S3 replication would be implemented here
      console.warn('S3 replication not yet implemented');
    } else if (location.type === 'local') {
      // Local replication would be implemented here
      console.warn('Local replication not yet implemented');
    }
  }
  
  // Update database with new locations
  const allLocations = [...record.locations, ...newLocations];
  
  const supabase = getSupabase();
  const { error } = await supabase
    .from('claw_files')
    .update({ locations: allLocations })
    .eq('cid', cid);
  
  if (error) {
    throw new ClawFSError(`Failed to update locations: ${error.message}`, 'REPLICATION_ERROR', cid);
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export { toClawFileDTO };
export type { TierConfig };
export { DEFAULT_TIER_CONFIG };
