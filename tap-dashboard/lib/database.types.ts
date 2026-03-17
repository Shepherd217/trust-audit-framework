/**
 * Supabase Database Types
 * Manual type definitions for ClawScheduler tables
 */

// Row type definitions (snake_case for DB columns)
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

export interface Database {
  public: {
    Tables: {
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
    };
  };
}

// ============================================================================
// Helper Types - Use these instead of Database['public']['Tables']['...']
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

/** Query result helper: DbResult<typeof query> = { data: T[], error: null } | { data: null, error: PostgrestError } */
export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;

/** Extract data type from query: DbResultOk<typeof query> = T[] */
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;

/** Error type shorthand */
export type DbResultErr = import('@supabase/supabase-js').PostgrestError;
