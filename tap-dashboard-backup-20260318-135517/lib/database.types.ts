/**
 * Supabase Database Types
 * Complete type definitions for MoltOS
 */

// ============================================================================
// Existing Tables (ClawScheduler)
// ============================================================================

export interface WorkflowRow {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: any[];
  edges: any[];
  start_node_id: string;
  end_node_ids?: string[];
  global_timeout_ms?: number;
  max_concurrent_nodes?: number;
  default_retry_policy?: any;
  owner_id: string;
  allowed_agent_ids?: string[];
  budget_limit?: number;
  payment_token?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  tags?: string[];
}

export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: string;
  current_node_id?: string;
  completed_node_ids: string[];
  node_executions: Record<string, any>;
  input: any;
  output?: any;
  context: any;
  active_branches: string[];
  pending_joins: Record<string, string[]>;
  started_at: string;
  completed_at?: string;
  estimated_completion_at?: string;
  progress_percent: number;
  budget_allocated: number;
  budget_spent: number;
  payments: any[];
  events: any[];
  retry_count: Record<string, number>;
  circuit_breaker_state: Record<string, any>;
  created_at: string;
  updated_at: string;
  workflow?: WorkflowRow;
}

export interface AgentTaskRow {
  id: string;
  execution_id: string;
  node_id: string;
  agent_id: string;
  task_type: string;
  input: any;
  context: any;
  payment: any;
  status: string;
  priority: number;
  created_at: string;
  deadline_at: string;
  completed_at?: string;
  result?: any;
}

export interface VMInstanceRow {
  id: string;
  agent_id: string;
  tier: string;
  state: string;
  config: any;
  created_at: string;
  started_at?: string;
  last_heartbeat?: string;
  pid?: number;
  exit_code?: number;
  error_message?: string;
  snapshot_id?: string;
  restart_count: number;
  resource_usage?: any;
}

export interface VMSnapshotRow {
  id: string;
  vm_id: string;
  agent_id: string;
  created_at: string;
  memory_snapshot_path: string;
  disk_snapshot_path: string;
  vm_state_snapshot_path: string;
  size_bytes: number;
  metadata?: any;
  restored_count: number;
  last_restored_at?: string;
}

// ============================================================================
// User Experience Tables
// ============================================================================

export interface ProfileRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  twitter: string | null;
  github: string | null;
  role: 'user' | 'admin' | 'moderator';
  reputation_score: number;
  total_agents: number;
  created_at: string;
  updated_at: string;
}

export interface AgentTemplateRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  category: string;
  tags: string[] | null;
  icon: string | null;
  image_url: string | null;
  price_per_hour: number;
  setup_fee: number;
  min_reputation: number;
  features: any[] | null;
  specs: Record<string, any> | null;
  config_schema: Record<string, any> | null;
  default_config: Record<string, any> | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAgentRow {
  id: string;
  user_id: string;
  agent_template_id: string | null;
  name: string;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'error' | 'suspended';
  health: 'healthy' | 'degraded' | 'critical' | 'unknown';
  config: Record<string, any>;
  hired_at: string;
  started_at: string | null;
  stopped_at: string | null;
  last_active_at: string | null;
  total_runtime_hours: number;
  tasks_completed: number;
  reputation_score: number;
  vm_instance_id: string | null;
  claw_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent_template?: AgentTemplateRow;
}

export interface AgentLogRow {
  id: string;
  agent_id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AgentMetricRow {
  id: string;
  agent_id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
}

export interface AgentRegistryRow {
  agent_id: string;
  name: string;
  public_key: string;
  api_key_hash: string;
  reputation: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  status: 'active' | 'inactive' | 'suspended';
  metadata: Record<string, any>;
  created_at: string;
  last_seen_at?: string;
}

export interface SwarmRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'idle' | 'error' | 'scaling';
  agent_ids: string[];
  region: string | null;
  throughput_per_min: number;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Database Schema
// ============================================================================

export interface Database {
  public: {
    Tables: {
      // ClawScheduler tables
      workflows: {
        Row: WorkflowRow;
        Insert: Partial<WorkflowRow>;
        Update: Partial<WorkflowRow>;
      };
      workflow_executions: {
        Row: WorkflowExecutionRow;
        Insert: Partial<WorkflowExecutionRow>;
        Update: Partial<WorkflowExecutionRow>;
      };
      agent_tasks: {
        Row: AgentTaskRow;
        Insert: Partial<AgentTaskRow>;
        Update: Partial<AgentTaskRow>;
      };
      vm_instances: {
        Row: VMInstanceRow;
        Insert: Partial<VMInstanceRow>;
        Update: Partial<VMInstanceRow>;
      };
      vm_snapshots: {
        Row: VMSnapshotRow;
        Insert: Partial<VMSnapshotRow>;
        Update: Partial<VMSnapshotRow>;
      };
      // User Experience tables
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
      };
      agent_templates: {
        Row: AgentTemplateRow;
        Insert: Partial<AgentTemplateRow>;
        Update: Partial<AgentTemplateRow>;
      };
      user_agents: {
        Row: UserAgentRow;
        Insert: Partial<UserAgentRow>;
        Update: Partial<UserAgentRow>;
      };
      agent_logs: {
        Row: AgentLogRow;
        Insert: Partial<AgentLogRow>;
        Update: Partial<AgentLogRow>;
      };
      agent_metrics: {
        Row: AgentMetricRow;
        Insert: Partial<AgentMetricRow>;
        Update: Partial<AgentMetricRow>;
      };
      agent_registry: {
        Row: AgentRegistryRow;
        Insert: Partial<AgentRegistryRow>;
        Update: Partial<AgentRegistryRow>;
      };
      swarms: {
        Row: SwarmRow;
        Insert: Partial<SwarmRow>;
        Update: Partial<SwarmRow>;
      };
    };
  };
}

// ============================================================================
// Helper Types
// ============================================================================

/** Table row type shorthand: Tables<'workflows'> = WorkflowRow */
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

/** Table insert type shorthand */
export type TablesInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

/** Table update type shorthand */
export type TablesUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];

/** Query result helper */
export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;

/** Extract data type from query */
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;

/** Error type shorthand */
export type DbResultErr = import('@supabase/supabase-js').PostgrestError;

// ============================================================================
// Enums & Constants
// ============================================================================

export const AGENT_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  STARTING: 'starting',
  STOPPING: 'stopping',
  ERROR: 'error',
  SUSPENDED: 'suspended',
} as const;

export const AGENT_HEALTH = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
} as const;

export const SWARM_STATUS = {
  ACTIVE: 'active',
  IDLE: 'idle',
  ERROR: 'error',
  SCALING: 'scaling',
} as const;

export const LOG_LEVEL = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
} as const;

export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const;
