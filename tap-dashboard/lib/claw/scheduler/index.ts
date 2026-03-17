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
  TaskResult,
  AgentTask,
  CircuitBreakerState,
  RetryPolicy,
  PaymentRecord,
  ExecutionStateSnapshot,
} from './types';
import { getClawBusService } from '../bus';
import { list as listKernelProcesses } from '../kernel';
import { ClawFSService } from '../fs';

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
    id: (n as any).id || `node_${i}`,
  }));
  
  const edges: WorkflowEdge[] = def.edges.map((e, i) => ({
    ...e,
    id: (e as any).id || `edge_${i}`,
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
    status: row.status as ExecutionState,
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
export async function getExecutionStatus(executionId: string): Promise<ExecutionStateSnapshot> {
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
    status: execution.status as ExecutionStatus,
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
// Execution Engine Methods (Part 2)
// ============================================================================

/**
 * Circuit breaker states in memory
 */
const circuitBreakerStates = new Map<string, CircuitBreakerState>();

/**
 * Get circuit breaker state for an agent
 */
function getCircuitBreakerState(agentId: string): CircuitBreakerState {
  if (!circuitBreakerStates.has(agentId)) {
    circuitBreakerStates.set(agentId, {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    });
  }
  return circuitBreakerStates.get(agentId)!;
}

/**
 * Check if circuit breaker allows execution
 */
function canExecute(circuitState: CircuitBreakerState): boolean {
  if (circuitState.state === 'closed') return true;
  if (circuitState.state === 'open') {
    const now = new Date();
    const timeoutMs = 60000; // 1 minute default
    if (circuitState.openedAt && now.getTime() - circuitState.openedAt.getTime() > timeoutMs) {
      circuitState.state = 'half-open';
      circuitState.halfOpenedAt = now;
      return true;
    }
    return false;
  }
  // half-open: allow limited execution
  return true;
}

/**
 * Record success for circuit breaker
 */
function recordSuccess(agentId: string): void {
  const state = getCircuitBreakerState(agentId);
  state.successCount++;
  state.lastSuccessAt = new Date();
  
  if (state.state === 'half-open') {
    if (state.successCount >= 3) {
      state.state = 'closed';
      state.failureCount = 0;
      state.successCount = 0;
    }
  } else {
    state.failureCount = 0;
  }
}

/**
 * Record failure for circuit breaker
 */
function recordFailure(agentId: string): void {
  const state = getCircuitBreakerState(agentId);
  state.failureCount++;
  state.lastFailureAt = new Date();
  
  const failureThreshold = 5;
  if (state.failureCount >= failureThreshold) {
    state.state = 'open';
    state.openedAt = new Date();
    state.successCount = 0;
  }
}

/**
 * Resolve agent for a node
 * - Returns specific agentId if configured
 * - Otherwise matches by capability/reputation
 */
async function resolveAgent(node: WorkflowNode): Promise<string | null> {
  // Direct agent assignment
  if (node.agentConfig?.agentId) {
    return node.agentConfig.agentId;
  }
  
  // TODO: Implement agent resolution by role/capability/reputation
  // For now, return a system agent or null
  if (node.agentConfig?.agentRole) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('agents')
      .select('id')
      .eq('role', node.agentConfig.agentRole)
      .gte('reputation_score', node.agentConfig.minReputation || 0)
      .eq('is_active', true)
      .order('reputation_score', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      return data.id;
    }
  }
  
  return null;
}

/**
 * Execute a node in a workflow
 * - Gets node config from workflow definition
 * - Resolves agent (specific ID or match by capability/reputation)
 * - Checks circuit breaker state
 * - Creates AgentTask record
 * - Sends via IPC if agent has ClawKernel process, else publishes via ClawBus
 * - Waits for result with timeout
 * - Stores result with reasoning trace
 * - Updates execution state
 */
export async function executeNode(
  executionId: string,
  nodeId: string
): Promise<TaskResult> {
  const supabase = getSupabaseClient();
  
  // Fetch execution and workflow
  const { data: executionData, error: execError } = await supabase
    .from('workflow_executions')
    .select('*, workflow:workflow_id(*)')
    .eq('id', executionId)
    .single();
  
  if (execError || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  const execution = mapRowToExecution(executionData);
  const workflow = executionData.workflow;
  
  // Find node config
  const node = workflow.nodes.find((n: any) => n.id === nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found in workflow`);
  }
  
  // Resolve agent
  const agentId = await resolveAgent(node);
  if (!agentId) {
    const errorResult: TaskResult = {
      success: false,
      error: {
        code: 'AGENT_NOT_FOUND',
        message: `Could not resolve agent for node ${nodeId}`,
        retryable: false,
      },
      metadata: {
        agentId: 'system',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    };
    await storeNodeResult(executionId, nodeId, errorResult);
    return errorResult;
  }
  
  // Check circuit breaker
  const circuitState = getCircuitBreakerState(agentId);
  if (!canExecute(circuitState)) {
    const errorResult: TaskResult = {
      success: false,
      error: {
        code: 'CIRCUIT_BREAKER_OPEN',
        message: `Circuit breaker is open for agent ${agentId}`,
        retryable: true,
      },
      metadata: {
        agentId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    };
    await storeNodeResult(executionId, nodeId, errorResult);
    return errorResult;
  }
  
  // Create AgentTask record
  const taskId = generateId();
  const taskInput = buildTaskInput(node, execution);
  const timeoutMs = node.agentConfig?.timeoutMs || 300000; // 5 min default
  
  const task: AgentTask = {
    id: taskId,
    executionId,
    nodeId,
    agentId,
    taskType: node.type,
    input: taskInput,
    context: {
      workflowId: execution.workflowId,
      executionId,
      nodeId,
      previousResults: Object.fromEntries(execution.nodeExecutions),
      executionContext: execution.context,
    },
    payment: {
      baseAmount: node.paymentConfig?.baseAmount || 0,
      reputationBonus: 0,
      escrowAmount: (node.paymentConfig?.baseAmount || 0) * (node.paymentConfig?.escrowPercent || 0) / 100,
      token: workflow.payment_token || 'USDC',
      released: false,
    },
    createdAt: new Date(),
    status: 'queued' as const,
    priority: execution.context.priority,
  };
  
  // Store task in database
  const { error: taskError } = await supabase
    .from('agent_tasks')
    .insert({
      id: taskId,
      execution_id: executionId,
      node_id: nodeId,
      agent_id: agentId,
      task_type: node.type,
      input: taskInput,
      context: task.context,
      payment: task.payment,
      status: 'queued',
      priority: task.priority,
      created_at: task.createdAt.toISOString(),
      deadline_at: new Date(Date.now() + timeoutMs).toISOString(),
    });
  
  if (taskError) {
    throw new Error(`Failed to create agent task: ${taskError.message}`);
  }
  
  // Update node execution status
  const nodeExecution = execution.nodeExecutions.get(nodeId);
  if (nodeExecution) {
    nodeExecution.status = 'running';
    nodeExecution.startedAt = new Date();
    nodeExecution.attempts++;
  }
  
  // Log node started event
  const startEvent = createWorkflowEvent(executionId, 'node_started', nodeId, {
    taskId,
    agentId,
    nodeType: node.type,
  });
  await logEvent(executionId, startEvent);
  
  // Check if agent has ClawKernel process
  let result: TaskResult;
  try {
    // Try to get agent process status from ClawKernel
    const agentProcesses = await listKernelProcesses();
    const agentProcess = agentProcesses.find(p => p.agentId === agentId && p.status === 'running');
    
    if (agentProcess) {
      // Send via IPC (implementation depends on IPC mechanism)
      result = await executeViaIPC(agentProcess.id, task, timeoutMs);
    } else {
      // Publish via ClawBus
      result = await executeViaBus(task, timeoutMs);
    }
    
    // Record success for circuit breaker
    if (result.success) {
      recordSuccess(agentId);
    } else {
      recordFailure(agentId);
    }
    
  } catch (error) {
    recordFailure(agentId);
    result = {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        retryable: true,
      },
      metadata: {
        agentId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    };
  }
  
  // Store result with reasoning trace
  await storeNodeResult(executionId, nodeId, result);
  
  // Update execution state
  if (result.success) {
    nodeExecution!.status = 'completed';
    nodeExecution!.completedAt = new Date();
    nodeExecution!.result = result;
    
    const completeEvent = createWorkflowEvent(executionId, 'node_completed', nodeId, {
      taskId,
      agentId,
      output: result.output,
    });
    await logEvent(executionId, completeEvent);
  } else {
    nodeExecution!.status = 'failed';
    nodeExecution!.completedAt = new Date();
    nodeExecution!.error = result.error as Error;
    
    const failEvent = createWorkflowEvent(executionId, 'node_failed', nodeId, {
      taskId,
      agentId,
      error: result.error,
    });
    await logEvent(executionId, failEvent);
  }
  
  return result;
}

/**
 * Build task input from node configuration and execution context
 */
function buildTaskInput(node: WorkflowNode, execution: WorkflowExecution): any {
  return {
    nodeType: node.type,
    nodeName: node.name,
    nodeDescription: node.description,
    executionInput: execution.input,
    executionContext: execution.context,
    previousResults: Object.fromEntries(
      Array.from(execution.nodeExecutions.entries())
        .filter(([_, ne]) => ne.status === 'completed')
        .map(([id, ne]) => [id, ne.result?.output])
    ),
  };
}

/**
 * Execute task via IPC to ClawKernel process
 */
async function executeViaIPC(processId: string, task: AgentTask, timeoutMs: number): Promise<TaskResult> {
  // TODO: Implement actual IPC communication
  // For now, simulate async execution
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`IPC execution timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Simulate IPC response
    setTimeout(() => {
      clearTimeout(timeout);
      resolve({
        success: true,
        output: { message: `Task ${task.id} executed via IPC` },
        metadata: {
          agentId: task.agentId!,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }, 100);
  });
}

/**
 * Execute task via ClawBus
 */
async function executeViaBus(task: AgentTask, timeoutMs: number): Promise<TaskResult> {
  const bus = getClawBusService();
  
  // Send task via bus
  await bus.send({
    type: 'task',
    from: 'scheduler',
    to: task.agentId!,
    payload: {
      taskId: task.id,
      executionId: task.executionId,
      nodeId: task.nodeId,
      input: task.input,
    },
    priority: task.priority,
  });
  
  // Wait for result with timeout
  const supabase = getSupabaseClient();
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second
  
  while (Date.now() - startTime < timeoutMs) {
    const { data } = await supabase
      .from('agent_tasks')
      .select('status, result')
      .eq('id', task.id)
      .single();
    
    if (data) {
      if (data.status === 'completed' && data.result) {
        return data.result as TaskResult;
      }
      if (data.status === 'failed') {
        return {
          success: false,
          error: {
            code: 'TASK_FAILED',
            message: 'Task execution failed',
            retryable: true,
          },
          metadata: {
            agentId: task.agentId!,
            startedAt: task.createdAt,
            completedAt: new Date(),
          },
        };
      }
    }
    
    await sleep(pollInterval);
  }
  
  throw new Error(`Bus execution timeout after ${timeoutMs}ms`);
}

/**
 * Store node execution result
 */
async function storeNodeResult(
  executionId: string,
  nodeId: string,
  result: TaskResult
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data: executionData } = await supabase
    .from('workflow_executions')
    .select('node_executions')
    .eq('id', executionId)
    .single();
  
  if (!executionData) return;
  
  const nodeExecutions = executionData.node_executions || {};
  nodeExecutions[nodeId] = {
    ...nodeExecutions[nodeId],
    status: result.success ? 'completed' : 'failed',
    result,
    completed_at: new Date().toISOString(),
  };
  
  await supabase
    .from('workflow_executions')
    .update({ node_executions: nodeExecutions })
    .eq('id', executionId);
}

/**
 * Log event to execution
 */
async function logEvent(executionId: string, event: WorkflowEvent): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data: executionData } = await supabase
    .from('workflow_executions')
    .select('events')
    .eq('id', executionId)
    .single();
  
  if (!executionData) return;
  
  const events = executionData.events || [];
  events.push({
    ...event,
    timestamp: event.timestamp.toISOString(),
  });
  
  await supabase
    .from('workflow_executions')
    .update({ events })
    .eq('id', executionId);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Transition to next node(s) in workflow
 * - Finds outgoing edges from node
 * - Evaluates edge conditions (if any)
 * - Determines next node(s)
 * - Handles parallel branches (fork)
 * - Handles join nodes (wait for all branches)
 * - Updates execution.current_node_id
 * - Logs transition event
 * - If end node → marks completed
 */
export async function transition(
  executionId: string,
  fromNodeId: string,
  result: TaskResult
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Fetch execution and workflow
  const { data: executionData, error: execError } = await supabase
    .from('workflow_executions')
    .select('*, workflow:workflow_id(*)')
    .eq('id', executionId)
    .single();
  
  if (execError || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  const execution = mapRowToExecution(executionData);
  const workflow = executionData.workflow;
  
  // Find outgoing edges
  const outgoingEdges = workflow.edges.filter((e: WorkflowEdge) => e.from === fromNodeId);
  
  if (outgoingEdges.length === 0) {
    // No outgoing edges - this might be an end node
    const isEndNode = workflow.end_node_ids?.includes(fromNodeId) || 
                      workflow.nodes.find((n: WorkflowNode) => n.id === fromNodeId)?.type === 'agent';
    
    if (isEndNode || workflow.end_node_ids === undefined) {
      // Mark execution as completed
      await markExecutionCompleted(executionId, result.output);
      return;
    }
  }
  
  // Evaluate edge conditions
  const validEdges = outgoingEdges.filter((edge: WorkflowEdge) => {
    if (!edge.condition) return true;
    return evaluateCondition(edge.condition, result);
  });
  
  // Sort by priority
  validEdges.sort((a: WorkflowEdge, b: WorkflowEdge) => (b.priority || 0) - (a.priority || 0));
  
  // Determine next nodes
  const nextNodes: string[] = validEdges.map((e: WorkflowEdge) => e.to);
  
  if (nextNodes.length === 0) {
    // No valid transition - this is a failure
    throw new Error(`No valid transition from node ${fromNodeId}`);
  }
  
  // Handle parallel branches (fork)
  const fromNode = workflow.nodes.find((n: WorkflowNode) => n.id === fromNodeId);
  if (fromNode?.type === 'parallel' && fromNode.parallelConfig) {
    // Fork into multiple branches
    for (const branch of fromNode.parallelConfig.branches) {
      for (const branchNodeId of branch) {
        execution.activeBranches.add(branchNodeId);
      }
    }
    
    const branchEvent = createWorkflowEvent(executionId, 'branch_started', fromNodeId, {
      branches: fromNode.parallelConfig.branches,
    });
    await logEvent(executionId, branchEvent);
  }
  
  // Handle join nodes
  for (const nextNodeId of nextNodes) {
    const nextNode = workflow.nodes.find((n: WorkflowNode) => n.id === nextNodeId);
    if (nextNode?.type === 'join') {
      // Check if all branches have completed
      const joinKey = `join_${nextNodeId}`;
      const waitingBranches = execution.pendingJoins.get(joinKey) || [];
      
      // Add current branch to waiting list
      if (!waitingBranches.includes(fromNodeId)) {
        waitingBranches.push(fromNodeId);
      }
      
      // Check if all required branches are complete
      const requiredBranches = nextNode.parallelConfig?.branches?.flat() || [];
      const allComplete = requiredBranches.every((branchId: string) => 
        execution.completedNodeIds.includes(branchId) || waitingBranches.includes(branchId)
      );
      
      if (!allComplete) {
        execution.pendingJoins.set(joinKey, waitingBranches);
        
        const joinWaitEvent = createWorkflowEvent(executionId, 'join_waiting', nextNodeId, {
          waitingFor: requiredBranches.filter((id: string) => !execution.completedNodeIds.includes(id)),
        });
        await logEvent(executionId, joinWaitEvent);
        
        // Don't proceed yet - wait for other branches
        continue;
      }
      
      // All branches complete - proceed
      execution.pendingJoins.delete(joinKey);
      
      const joinCompleteEvent = createWorkflowEvent(executionId, 'join_completed', nextNodeId, {
        completedBranches: waitingBranches,
      });
      await logEvent(executionId, joinCompleteEvent);
    }
  }
  
  // Update execution state
  const completedNodeIds = [...execution.completedNodeIds, fromNodeId];
  const currentNodeId = nextNodes[0]; // Primary path
  
  await supabase
    .from('workflow_executions')
    .update({
      current_node_id: currentNodeId,
      completed_node_ids: completedNodeIds,
      active_branches: Array.from(execution.activeBranches),
      pending_joins: Object.fromEntries(execution.pendingJoins),
    })
    .eq('id', executionId);
  
  // Log transition event
  const transitionEvent = createWorkflowEvent(executionId, 'node_completed', fromNodeId, {
    nextNodes,
    result: result.success ? 'success' : 'failure',
  });
  await logEvent(executionId, transitionEvent);
  
  // Check if we've reached an end node
  if (workflow.end_node_ids?.includes(currentNodeId)) {
    await markExecutionCompleted(executionId, result.output);
  }
}

/**
 * Evaluate a condition expression against a result
 */
function evaluateCondition(condition: string, result: TaskResult): boolean {
  try {
    // Simple expression evaluation
    // Supports: success, failure, result.field == value, result.field > value, etc.
    if (condition === 'success') return result.success;
    if (condition === 'failure') return !result.success;
    
    // More complex conditions can be added here
    // For now, default to true
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark execution as completed
 */
async function markExecutionCompleted(executionId: string, output?: any): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('workflow_executions')
    .update({
      status: 'completed',
      output,
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      current_node_id: null,
    })
    .eq('id', executionId);
  
  const completeEvent = createWorkflowEvent(executionId, 'execution_completed', undefined, {
    output,
  });
  await logEvent(executionId, completeEvent);
}

/**
 * Pause a workflow execution
 * - Sets state to PAUSED
 * - Stops scheduling new nodes
 * - Persists current state
 * - Logs pause event
 */
export async function pauseExecution(executionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Verify execution exists and is running
  const { data: executionData, error } = await supabase
    .from('workflow_executions')
    .select('status')
    .eq('id', executionId)
    .single();
  
  if (error || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  if (executionData.status !== 'running') {
    throw new Error(`Cannot pause execution with status: ${executionData.status}`);
  }
  
  // Update state to PAUSED
  const { error: updateError } = await supabase
    .from('workflow_executions')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId);
  
  if (updateError) {
    throw new Error(`Failed to pause execution: ${updateError.message}`);
  }
  
  // Log pause event
  const pauseEvent = createWorkflowEvent(executionId, 'execution_paused');
  await logEvent(executionId, pauseEvent);
}

/**
 * Resume a paused workflow execution
 * - Sets state to RUNNING
 * - Resumes from current node
 * - Logs resume event
 */
export async function resumeExecution(executionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Verify execution exists and is paused
  const { data: executionData, error } = await supabase
    .from('workflow_executions')
    .select('status, current_node_id')
    .eq('id', executionId)
    .single();
  
  if (error || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  if (executionData.status !== 'paused') {
    throw new Error(`Cannot resume execution with status: ${executionData.status}`);
  }
  
  // Update state to RUNNING
  const { error: updateError } = await supabase
    .from('workflow_executions')
    .update({
      status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId);
  
  if (updateError) {
    throw new Error(`Failed to resume execution: ${updateError.message}`);
  }
  
  // Log resume event
  const resumeEvent = createWorkflowEvent(executionId, 'execution_resumed', executionData.current_node_id, {
    resumedFrom: executionData.current_node_id,
  });
  await logEvent(executionId, resumeEvent);
}

/**
 * Cancel a workflow execution
 * - Sets state to CANCELLED
 * - Triggers compensation for completed nodes (Saga pattern)
 * - Releases allocated payments from escrow
 * - Logs cancel event
 */
export async function cancelExecution(
  executionId: string,
  reason?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Verify execution exists
  const { data: executionData, error } = await supabase
    .from('workflow_executions')
    .select('status, node_executions, payments')
    .eq('id', executionId)
    .single();
  
  if (error || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  if (['completed', 'cancelled', 'failed'].includes(executionData.status)) {
    throw new Error(`Cannot cancel execution with status: ${executionData.status}`);
  }
  
  // Trigger compensation for completed nodes (Saga pattern)
  const nodeExecutions = executionData.node_executions || {};
  const completedNodes = Object.entries(nodeExecutions)
    .filter(([_, ne]: [string, any]) => ne.status === 'completed')
    .map(([nodeId, _]) => nodeId);
  
  if (completedNodes.length > 0) {
    const compensationEvent = createWorkflowEvent(executionId, 'compensation_started', undefined, {
      nodesToCompensate: completedNodes,
      reason,
    });
    await logEvent(executionId, compensationEvent);
    
    // Execute compensation for each completed node
    for (const nodeId of completedNodes) {
      try {
        await compensateNode(executionId, nodeId);
      } catch (compError) {
        const compFailEvent = createWorkflowEvent(executionId, 'compensation_failed', nodeId, {
          error: compError instanceof Error ? compError.message : 'Unknown error',
        });
        await logEvent(executionId, compFailEvent);
      }
    }
    
    const compCompleteEvent = createWorkflowEvent(executionId, 'compensation_completed');
    await logEvent(executionId, compCompleteEvent);
  }
  
  // Release allocated payments from escrow
  const payments: PaymentRecord[] = executionData.payments || [];
  for (const payment of payments) {
    if (payment.status === 'held') {
      try {
        await releasePaymentFromEscrow(executionId, payment.id);
      } catch (paymentError) {
        console.error(`Failed to release payment ${payment.id}:`, paymentError);
      }
    }
  }
  
  // Update state to CANCELLED
  const { error: updateError } = await supabase
    .from('workflow_executions')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', executionId);
  
  if (updateError) {
    throw new Error(`Failed to cancel execution: ${updateError.message}`);
  }
  
  // Log cancel event
  const cancelEvent = createWorkflowEvent(executionId, 'execution_cancelled', undefined, {
    reason: reason || 'Cancelled by user',
    compensatedNodes: completedNodes.length,
  });
  await logEvent(executionId, cancelEvent);
}

/**
 * Compensate a completed node (Saga pattern)
 */
async function compensateNode(executionId: string, nodeId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get node execution details
  const { data } = await supabase
    .from('workflow_executions')
    .select('node_executions')
    .eq('id', executionId)
    .single();
  
  if (!data) return;
  
  const nodeExecution = data.node_executions?.[nodeId];
  if (!nodeExecution?.compensationData) return;
  
  // TODO: Implement actual compensation logic
  // This would involve calling compensation handlers, rolling back state, etc.
  
  // Update node execution with compensation status
  data.node_executions[nodeId] = {
    ...nodeExecution,
    compensated: true,
    compensatedAt: new Date().toISOString(),
  };
  
  await supabase
    .from('workflow_executions')
    .update({ node_executions: data.node_executions })
    .eq('id', executionId);
}

/**
 * Release payment from escrow
 */
async function releasePaymentFromEscrow(executionId: string, paymentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('workflow_executions')
    .select('payments')
    .eq('id', executionId)
    .single();
  
  if (!data?.payments) return;
  
  const payments = data.payments.map((p: PaymentRecord) => {
    if (p.id === paymentId) {
      return {
        ...p,
        status: 'rolled_back',
        releasedAt: new Date().toISOString(),
      };
    }
    return p;
  });
  
  await supabase
    .from('workflow_executions')
    .update({ payments })
    .eq('id', executionId);
  
  // Log payment rollback
  const rollbackEvent = createWorkflowEvent(executionId, 'payment_rolled_back', undefined, {
    paymentId,
  });
  await logEvent(executionId, rollbackEvent);
}

/**
 * Retry a failed node
 * - Gets retry policy from node config
 * - Checks circuit breaker
 * - Increments retry count
 * - Re-executes node
 */
export async function retryFailedNode(
  executionId: string,
  nodeId: string
): Promise<TaskResult> {
  const supabase = getSupabaseClient();
  
  // Fetch execution and workflow
  const { data: executionData, error: execError } = await supabase
    .from('workflow_executions')
    .select('*, workflow:workflow_id(*)')
    .eq('id', executionId)
    .single();
  
  if (execError || !executionData) {
    throw new Error(`Execution not found: ${executionId}`);
  }
  
  const execution = mapRowToExecution(executionData);
  const workflow = executionData.workflow;
  
  // Find node config
  const node = workflow.nodes.find((n: WorkflowNode) => n.id === nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found in workflow`);
  }
  
  // Get retry policy
  const retryPolicy: RetryPolicy = node.agentConfig?.maxRetries 
    ? {
        maxAttempts: node.agentConfig.maxRetries,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      }
    : workflow.default_retry_policy || {
        maxAttempts: 3,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };
  
  // Check current retry count
  const currentRetries = execution.retryCount.get(nodeId) || 0;
  
  if (currentRetries >= retryPolicy.maxAttempts) {
    const errorResult: TaskResult = {
      success: false,
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        message: `Maximum retry attempts (${retryPolicy.maxAttempts}) exceeded for node ${nodeId}`,
        retryable: false,
      },
      metadata: {
        agentId: 'system',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    };
    return errorResult;
  }
  
  // Resolve agent
  const agentId = await resolveAgent(node);
  if (!agentId) {
    throw new Error(`Could not resolve agent for node ${nodeId}`);
  }
  
  // Check circuit breaker
  const circuitState = getCircuitBreakerState(agentId);
  if (!canExecute(circuitState)) {
    const errorResult: TaskResult = {
      success: false,
      error: {
        code: 'CIRCUIT_BREAKER_OPEN',
        message: `Circuit breaker is open for agent ${agentId}`,
        retryable: true,
      },
      metadata: {
        agentId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    };
    return errorResult;
  }
  
  // Increment retry count
  const newRetryCount = currentRetries + 1;
  execution.retryCount.set(nodeId, newRetryCount);
  
  await supabase
    .from('workflow_executions')
    .update({
      retry_count: Object.fromEntries(execution.retryCount),
    })
    .eq('id', executionId);
  
  // Log retry event
  const retryEvent = createWorkflowEvent(executionId, 'node_retrying', nodeId, {
    attempt: newRetryCount,
    maxAttempts: retryPolicy.maxAttempts,
  });
  await logEvent(executionId, retryEvent);
  
  // Calculate backoff delay
  let delayMs = retryPolicy.baseDelayMs;
  if (retryPolicy.backoffType === 'exponential') {
    delayMs = Math.min(
      retryPolicy.baseDelayMs * Math.pow(2, currentRetries),
      retryPolicy.maxDelayMs
    );
  } else if (retryPolicy.backoffType === 'linear') {
    delayMs = Math.min(
      retryPolicy.baseDelayMs * (currentRetries + 1),
      retryPolicy.maxDelayMs
    );
  }
  
  // Add jitter if enabled
  if (retryPolicy.jitter) {
    const jitterMax = retryPolicy.jitterMaxMs || 1000;
    delayMs += Math.random() * jitterMax;
  }
  
  // Wait for backoff
  await sleep(delayMs);
  
  // Re-execute node
  return executeNode(executionId, nodeId);
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
  executeNode,
  transition,
  pauseExecution,
  resumeExecution,
  cancelExecution,
  retryFailedNode,
};

export default ClawScheduler;
