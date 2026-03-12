/**
 * ClawScheduler Service
 * Core workflow orchestration engine for TAP
 */

import { getSupabaseClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  ExecutionContext,
  ExecutionState,
  ExecutionStatus,
  NodeExecution,
  NodeExecutionStatus,
  WorkflowEvent,
  WorkflowEventType,
  ValidationResult,
  ValidationError,
} from './types';

// ============================================================================
// Types for Database Schema
// ============================================================================

interface WorkflowRow {
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

interface ExecutionRow {
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
  circuit_breaker_state: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface ListWorkflowsFilters {
  owner?: string;
  tags?: string[];
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
}

interface ListExecutionsFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Detect cycles in a directed graph using DFS
 */
function detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));
  const adjacency = new Map<string, string[]>();
  
  // Build adjacency list
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    adjacency.get(edge.from)!.push(edge.to);
  }
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!nodeIds.has(neighbor)) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge references non-existent node: ${neighbor}`,
        });
        continue;
      }
      
      if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart).concat(neighbor);
        errors.push({
          code: 'CYCLE_DETECTED',
          message: `Workflow contains cycle: ${cycle.join(' → ')}`,
        });
        return true;
      }
      
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) return true;
      }
    }
    
    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }
  
  return errors;
}

/**
 * Validate workflow definition
 */
function validateWorkflowDefinition(def: WorkflowDefinition): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Assign IDs to nodes and edges if not present
  const nodes: WorkflowNode[] = def.nodes.map((n, i) => ({
    ...n,
    id: n.id || `node_${i}`,
  }));
  
  const edges: WorkflowEdge[] = def.edges.map((e, i) => ({
    ...e,
    id: e.id || `edge_${i}`,
  }));
  
  // Validate required fields
  if (!def.name || def.name.trim().length === 0) {
    errors.push({ code: 'MISSING_NAME', message: 'Workflow name is required' });
  }
  
  if (nodes.length === 0) {
    errors.push({ code: 'EMPTY_WORKFLOW', message: 'Workflow must have at least one node' });
  }
  
  // Validate start node
  const nodeIds = new Set(nodes.map(n => n.id));
  let startNodeId = def.startNodeId;
  
  if (!startNodeId && nodes.length > 0) {
    // Auto-assign first node as start if not specified
    startNodeId = nodes[0].id;
    warnings.push({
      code: 'AUTO_START_NODE',
      message: `Start node not specified, using first node: ${startNodeId}`,
    });
  }
  
  if (startNodeId && !nodeIds.has(startNodeId)) {
    errors.push({
      code: 'INVALID_START_NODE',
      message: `Start node '${startNodeId}' does not exist`,
    });
  }
  
  // Validate edges reference valid nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push({
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge references non-existent source node: ${edge.from}`,
        edgeId: edge.id,
      });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({
        code: 'INVALID_EDGE_TARGET',
        message: `Edge references non-existent target node: ${edge.to}`,
        edgeId: edge.id,
      });
    }
  }
  
  // Detect cycles (critical for DAG validation)
  const cycleErrors = detectCycle(nodes, edges);
  errors.push(...cycleErrors);
  
  // Validate node configurations based on type
  for (const node of nodes) {
    switch (node.type) {
      case 'agent':
        if (!node.agentConfig) {
          errors.push({
            code: 'MISSING_AGENT_CONFIG',
            message: `Agent node '${node.id}' is missing agent configuration`,
            nodeId: node.id,
          });
        } else if (!node.agentConfig.agentId && !node.agentConfig.agentRole) {
          warnings.push({
            code: 'AGENT_NOT_SPECIFIED',
            message: `Agent node '${node.id}' has no specific agent or role`,
            nodeId: node.id,
          });
        }
        break;
        
      case 'human':
        if (!node.humanConfig) {
          errors.push({
            code: 'MISSING_HUMAN_CONFIG',
            message: `Human node '${node.id}' is missing human configuration`,
            nodeId: node.id,
          });
        } else if (!node.humanConfig.approvers || node.humanConfig.approvers.length === 0) {
          errors.push({
            code: 'NO_APPROVERS',
            message: `Human node '${node.id}' has no approvers specified`,
            nodeId: node.id,
          });
        }
        break;
        
      case 'condition':
        if (!node.conditionConfig) {
          errors.push({
            code: 'MISSING_CONDITION_CONFIG',
            message: `Condition node '${node.id}' is missing condition configuration`,
            nodeId: node.id,
          });
        }
        break;
        
      case 'parallel':
        if (!node.parallelConfig || !node.parallelConfig.branches || node.parallelConfig.branches.length === 0) {
          errors.push({
            code: 'MISSING_PARALLEL_CONFIG',
            message: `Parallel node '${node.id}' is missing branch configuration`,
            nodeId: node.id,
          });
        }
        break;
        
      case 'delay':
        if (!node.delayConfig || typeof node.delayConfig.durationMs !== 'number') {
          errors.push({
            code: 'MISSING_DELAY_CONFIG',
            message: `Delay node '${node.id}' is missing valid duration`,
            nodeId: node.id,
          });
        }
        break;
        
      case 'subworkflow':
        if (!node.subworkflowConfig || !node.subworkflowConfig.workflowId) {
          errors.push({
            code: 'MISSING_SUBWORKFLOW_CONFIG',
            message: `Subworkflow node '${node.id}' is missing workflow reference`,
            nodeId: node.id,
          });
        }
        break;
    }
  }
  
  // Check for unreachable nodes
  const reachable = new Set<string>();
  if (startNodeId) {
    const queue = [startNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      
      for (const edge of edges) {
        if (edge.from === current && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }
  }
  
  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({
        code: 'UNREACHABLE_NODE',
        message: `Node '${node.id}' is unreachable from start node`,
        nodeId: node.id,
      });
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return uuidv4();
}

function now(): Date {
  return new Date();
}

function createWorkflowEvent(
  executionId: string,
  type: WorkflowEventType,
  nodeId?: string,
  payload?: any
): WorkflowEvent {
  return {
    id: generateId(),
    executionId,
    type,
    timestamp: now(),
    nodeId,
    payload: payload || {},
    correlationId: generateId(),
  };
}

function mapRowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    nodes: row.nodes || [],
    edges: row.edges || [],
    startNodeId: row.start_node_id,
    endNodeIds: row.end_node_ids,
    globalTimeoutMs: row.global_timeout_ms,
    maxConcurrentNodes: row.max_concurrent_nodes,
    defaultRetryPolicy: row.default_retry_policy,
    ownerId: row.owner_id,
    allowedAgentIds: row.allowed_agent_ids,
    budgetLimit: row.budget_limit,
    paymentToken: row.payment_token,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    isActive: row.is_active,
  };
}

function mapRowToExecution(row: ExecutionRow): WorkflowExecution {
  const nodeExecutions = new Map<string, NodeExecution>();
  for (const [key, value] of Object.entries(row.node_executions || {})) {
    nodeExecutions.set(key, {
      ...value,
      startedAt: value.started_at ? new Date(value.started_at) : undefined,
      completedAt: value.completed_at ? new Date(value.completed_at) : undefined,
    });
  }
  
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowVersion: row.workflow_version,
    status: row.status as ExecutionStatus,
    currentNodeId: row.current_node_id,
    completedNodeIds: row.completed_node_ids || [],
    nodeExecutions,
    input: row.input,
    output: row.output,
    context: row.context,
    activeBranches: new Set(row.active_branches || []),
    pendingJoins: new Map(Object.entries(row.pending_joins || {})),
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    estimatedCompletionAt: row.estimated_completion_at ? new Date(row.estimated_completion_at) : undefined,
    progressPercent: row.progress_percent || 0,
    budgetAllocated: row.budget_allocated || 0,
    budgetSpent: row.budget_spent || 0,
    payments: row.payments || [],
    events: (row.events || []).map((e: any) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    })),
    retryCount: new Map(Object.entries(row.retry_count || {})),
    circuitBreakerState: new Map(Object.entries(row.circuit_breaker_state || {})),
  };
}

// ============================================================================
// Core Scheduler Functions
// ============================================================================

/**
 * Create a new workflow
 * Validates DAG (detects cycles), stores in Supabase, returns workflow with ID
 */
export async function createWorkflow(
  definition: WorkflowDefinition,
  ownerId?: string
): Promise<Workflow> {
  const supabase = getSupabaseClient();
  
  // Validate the workflow definition
  const validation = validateWorkflowDefinition(definition);
  if (!validation.valid) {
    const errorMessages = validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ');
    throw new Error(`Workflow validation failed: ${errorMessages}`);
  }
  
  // Assign IDs to nodes and edges
  const nodes: WorkflowNode[] = definition.nodes.map((n, i) => ({
    ...n,
    id: n.id || `node_${i}_${generateId().slice(0, 8)}`,
  }));
  
  const edges: WorkflowEdge[] = definition.edges.map((e, i) => ({
    ...e,
    id: e.id || `edge_${i}_${generateId().slice(0, 8)}`,
  }));
  
  // Determine start node
  let startNodeId = definition.startNodeId;
  if (!startNodeId && nodes.length > 0) {
    startNodeId = nodes[0].id;
  }
  
  // Build workflow object
  const workflowId = generateId();
  const workflow: Omit<WorkflowRow, 'created_at' | 'updated_at'> = {
    id: workflowId,
    name: definition.name,
    description: definition.description,
    version: 1,
    nodes,
    edges,
    start_node_id: startNodeId!,
    global_timeout_ms: definition.globalTimeoutMs,
    max_concurrent_nodes: definition.maxConcurrentNodes,
    default_retry_policy: definition.defaultRetryPolicy,
    owner_id: ownerId || 'system',
    budget_limit: definition.budgetLimit,
    payment_token: definition.paymentToken,
    is_active: true,
  };
  
  // Store in Supabase
  const { data, error } = await supabase
    .from('workflows')
    .insert(workflow)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create workflow: ${error.message}`);
  }
  
  return mapRowToWorkflow(data);
}

/**
 * Execute a workflow
 * Creates execution instance, initializes event log, starts at entry node
 */
export async function executeWorkflow(
  workflowId: string,
  input: any,
  context: ExecutionContext
): Promise<WorkflowExecution> {
  const supabase = getSupabaseClient();
  
  // Fetch the workflow
  const { data: workflowData, error: workflowError } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .eq('is_active', true)
    .single();
  
  if (workflowError || !workflowData) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }
  
  const workflow = mapRowToWorkflow(workflowData);
  
  // Create execution record
  const executionId = generateId();
  const startedAt = now();
  
  const initialEvents: WorkflowEvent[] = [
    createWorkflowEvent(executionId, 'execution_started', undefined, {
      workflowId,
      workflowVersion: workflow.version,
      input,
    }),
  ];
  
  // Initialize node executions
  const nodeExecutions: Record<string, NodeExecution> = {};
  for (const node of workflow.nodes) {
    nodeExecutions[node.id] = {
      nodeId: node.id,
      status: 'pending' as NodeExecutionStatus,
      attempts: 0,
    };
  }
  
  // Set start node to running
  if (workflow.startNodeId && nodeExecutions[workflow.startNodeId]) {
    nodeExecutions[workflow.startNodeId].status = 'running';
    nodeExecutions[workflow.startNodeId].startedAt = startedAt;
    initialEvents.push(
      createWorkflowEvent(executionId, 'node_started', workflow.startNodeId, {
        nodeType: workflow.nodes.find(n => n.id === workflow.startNodeId)?.type,
      })
    );
  }
  
  // Calculate estimated completion
  const estimatedDuration = workflow.globalTimeoutMs || 300000; // Default 5 minutes
  const estimatedCompletionAt = new Date(startedAt.getTime() + estimatedDuration);
  
  const executionRow: any = {
    id: executionId,
    workflow_id: workflowId,
    workflow_version: workflow.version,
    status: 'running',
    current_node_id: workflow.startNodeId,
    completed_node_ids: [],
    node_executions: nodeExecutions,
    input,
    context,
    active_branches: workflow.startNodeId ? [workflow.startNodeId] : [],
    pending_joins: {},
    started_at: startedAt.toISOString(),
    estimated_completion_at: estimatedCompletionAt.toISOString(),
    progress_percent: 0,
    budget_allocated: workflow.budgetLimit || 0,
    budget_spent: 0,
    payments: [],
    events: initialEvents.map(e => ({
      ...e,
      timestamp: e.timestamp.toISOString(),
    })),
    retry_count: {},
    circuit_breaker_state: {},
  };
  
  const { data, error } = await supabase
    .from('workflow_executions')
    .insert(executionRow)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create workflow execution: ${error.message}`);
  }
  
  return mapRowToExecution(data);
}

/**
 * Get execution status
 * Returns current node, progress %, token/cost tracking, event history summary
 */
export async function getExecutionStatus(executionId: string): Promise<ExecutionState> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('workflow_executions')
    .select(`
      *,
      workflow:workflow_id(name, nodes)
    `)
    .eq('id', executionId)
    .single();
  
  if (error || !data) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  const execution = mapRowToExecution(data);
  const workflow = data.workflow;
  
  // Calculate time metrics
  const nowTime = now().getTime();
  const startedAtTime = execution.startedAt.getTime();
  const timeElapsedMs = nowTime - startedAtTime;
  
  let timeRemainingMs: number | undefined;
  if (execution.estimatedCompletionAt && execution.status === 'running') {
    timeRemainingMs = Math.max(0, execution.estimatedCompletionAt.getTime() - nowTime);
  }
  
  // Get current node name if available
  let currentNodeName: string | undefined;
  if (execution.currentNodeId && workflow?.nodes) {
    const currentNode = workflow.nodes.find((n: any) => n.id === execution.currentNodeId);
    currentNodeName = currentNode?.name;
  }
  
  // Get recent events (last 10)
  const recentEvents = execution.events.slice(-10);
  
  // Count total nodes
  const totalNodes = workflow?.nodes?.length || 0;
  
  return {
    executionId: execution.id,
    workflowId: execution.workflowId,
    status: execution.status,
    currentNodeId: execution.currentNodeId,
    currentNodeName,
    progressPercent: execution.progressPercent,
    startedAt: execution.startedAt,
    estimatedCompletionAt: execution.estimatedCompletionAt,
    timeElapsedMs,
    timeRemainingMs,
    budgetSpent: execution.budgetSpent,
    budgetLimit: execution.budgetAllocated > 0 ? execution.budgetAllocated : undefined,
    activeBranches: execution.activeBranches.size,
    completedNodes: execution.completedNodeIds.length,
    totalNodes,
    recentEvents,
  };
}

/**
 * List workflows with filtering and pagination
 */
export async function listWorkflows(filters: ListWorkflowsFilters = {}): Promise<{
  workflows: Workflow[];
  total: number;
  hasMore: boolean;
}> {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('workflows')
    .select('*', { count: 'exact' });
  
  // Apply filters
  if (filters.owner) {
    query = query.eq('owner_id', filters.owner);
  }
  
  if (filters.tags && filters.tags.length > 0) {
    // Use overlap operator for tags array
    query = query.overlaps('tags', filters.tags);
  }
  
  if (filters.status === 'active') {
    query = query.eq('is_active', true);
  } else if (filters.status === 'inactive') {
    query = query.eq('is_active', false);
  }
  
  // Apply pagination
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  
  query = query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to list workflows: ${error.message}`);
  }
  
  const workflows = (data || []).map(mapRowToWorkflow);
  const total = count || 0;
  
  return {
    workflows,
    total,
    hasMore: offset + workflows.length < total,
  };
}

/**
 * List executions with filtering and pagination
 */
export async function listExecutions(filters: ListExecutionsFilters = {}): Promise<{
  executions: WorkflowExecution[];
  total: number;
  hasMore: boolean;
}> {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('workflow_executions')
    .select('*', { count: 'exact' });
  
  // Apply filters
  if (filters.workflowId) {
    query = query.eq('workflow_id', filters.workflowId);
  }
  
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.startDate) {
    query = query.gte('started_at', filters.startDate.toISOString());
  }
  
  if (filters.endDate) {
    query = query.lte('started_at', filters.endDate.toISOString());
  }
  
  // Apply pagination
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  
  query = query
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to list executions: ${error.message}`);
  }
  
  const executions = (data || []).map(mapRowToExecution);
  const total = count || 0;
  
  return {
    executions,
    total,
    hasMore: offset + executions.length < total,
  };
}

// ============================================================================
// Export all functions as ClawScheduler namespace
// ============================================================================

export const ClawScheduler = {
  createWorkflow,
  executeWorkflow,
  getExecutionStatus,
  listWorkflows,
  listExecutions,
  validateWorkflowDefinition,
};

export default ClawScheduler;
