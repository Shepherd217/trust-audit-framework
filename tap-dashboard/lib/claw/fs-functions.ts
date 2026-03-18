/**
 * ClawFS Function Exports
 * Wrapper functions for API routes
 */

import { createClient } from '@supabase/supabase-js';
import { FileMetadata, Permission, StorageTier } from './fs/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  tier?: StorageTier;
  type?: string;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
}

// Helper to get Supabase client
function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export async function store(input: StoreInput, agentId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('files')
    .insert({
      owner_id: agentId,
      content: input.content,
      metadata: input.metadata || {},
      permissions: input.permissions || [],
      storage_tier: 'warm',
      version: 1
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function retrieve(fileId: string, agentId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('owner_id', agentId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function list(agentId: string, filters?: ListFilters) {
  const supabase = getSupabase();
  let query = supabase
    .from('files')
    .select('*')
    .eq('owner_id', agentId);
  
  if (filters?.tier) {
    query = query.eq('storage_tier', filters.tier);
  }
  if (filters?.type) {
    query = query.eq('metadata->mimeType', filters.type);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function remove(fileId: string, agentId: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId)
    .eq('owner_id', agentId);
  
  if (error) throw error;
  return { success: true };
}

export async function search(input: SearchInput, agentId: string) {
  const supabase = getSupabase();
  
  let query = supabase
    .from('files')
    .select('*')
    .eq('owner_id', agentId)
    .or(`metadata->name.ilike.%${input.query}%,metadata->description.ilike.%${input.query}%`);
  
  if (input.filters?.tier) {
    query = query.eq('storage_tier', input.filters.tier);
  }
  if (input.filters?.limit) {
    query = query.limit(input.filters.limit);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function share(input: ShareInput, agentId: string) {
  const supabase = getSupabase();
  
  const permission: Partial<Permission> = {
    agentId: input.targetAgentId,
    canRead: input.permissions === 'read' || input.permissions === 'write' || input.permissions === 'admin',
    canWrite: input.permissions === 'write' || input.permissions === 'admin',
    canDelete: input.permissions === 'admin',
    canShare: input.permissions === 'admin',
    grantedAt: new Date(),
    grantedBy: agentId
  };
  
  const { data, error } = await supabase
    .from('file_permissions')
    .insert({
      file_id: input.fileId,
      agent_id: input.targetAgentId,
      permissions: permission,
      granted_by: agentId,
      expires_at: input.expiresAt
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function update(fileId: string, input: UpdateInput, agentId: string) {
  const supabase = getSupabase();
  
  // Get current version
  const { data: current } = await supabase
    .from('files')
    .select('version')
    .eq('id', fileId)
    .eq('owner_id', agentId)
    .single();
  
  if (!current || current.version !== input.expectedVersion) {
    throw new Error('Version conflict');
  }
  
  const { data, error } = await supabase
    .from('files')
    .update({
      content: input.content,
      version: current.version + 1
    })
    .eq('id', fileId)
    .eq('owner_id', agentId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function versions(fileId: string, agentId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('file_versions')
    .select('*')
    .eq('file_id', fileId)
    .eq('owner_id', agentId)
    .order('version', { ascending: false });
  
  if (error) throw error;
  return data || [];
}
