/**
 * ClawFS Function Exports
 * Wrapper functions for API routes
 */

import { createClawFSService, FileMetadata, Permission, StorageTier } from './fs';

const service = createClawFSService({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  defaultStorageTier: 'warm'
});

interface StoreInput {
  content: string;
  metadata?: Partial<FileMetadata>;
  permissions?: Permission[];
}

interface UpdateInput {
  content: string;
  expectedVersion: number;
}

interface ShareInput {
  fileId: string;
  targetAgentId: string;
  permissions: 'read' | 'write' | 'admin';
  expiresAt?: Date;
}

interface SearchInput {
  query: string;
  filters?: {
    tier?: 'hot' | 'warm' | 'cold';
    createdAfter?: Date;
    createdBefore?: Date;
    limit?: number;
  };
}

interface ListFilters {
  tier?: 'hot' | 'warm' | 'cold';
  type?: string;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
}

function toStorageTier(tier?: 'hot' | 'warm' | 'cold'): StorageTier | undefined {
  if (!tier) return undefined;
  switch (tier) {
    case 'hot': return StorageTier.HOT;
    case 'warm': return StorageTier.WARM;
    case 'cold': return StorageTier.COLD;
    default: return undefined;
  }
}

export async function store(input: StoreInput, agentId: string) {
  return service.store(agentId, input.content, input.metadata || {}, input.permissions);
}

export async function retrieve(fileId: string, agentId: string) {
  return service.retrieve(agentId, fileId);
}

export async function list(agentId: string, filters?: ListFilters) {
  const serviceFilters = filters ? {
    ...filters,
    tier: toStorageTier(filters.tier)
  } : undefined;
  return service.list(agentId, serviceFilters);
}

export async function remove(fileId: string, agentId: string) {
  return service.delete(agentId, fileId);
}

export async function search(input: SearchInput, agentId: string) {
  return service.search(agentId, input.query, { 
    limit: input.filters?.limit,
    filterByTier: input.filters?.tier ? [toStorageTier(input.filters.tier)!] : undefined
  });
}

export async function share(input: ShareInput, agentId: string) {
  const perms: Partial<Permission> = {
    canRead: input.permissions === 'read' || input.permissions === 'write' || input.permissions === 'admin',
    canWrite: input.permissions === 'write' || input.permissions === 'admin',
    canDelete: input.permissions === 'admin',
    canShare: input.permissions === 'admin',
  };
  return service.share(agentId, input.fileId, input.targetAgentId, perms);
}

export async function update(fileId: string, input: UpdateInput, agentId: string) {
  return service.update(agentId, fileId, input.content, input.expectedVersion);
}

export async function versions(fileId: string, agentId: string) {
  return service.getVersionHistory(agentId, fileId);
}
