/**
 * ClawScheduler Types
 * Core type definitions for Workflow Orchestration
 */

// ============================================================================
// Enums
// ============================================================================

export enum ExecutionState {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMED_OUT = 'timed_out',
}

export enum EventType {
  WORKFLOW_STARTED = 'workflow_started',
  WORKFLOW_COMPLETED = 'workflow_completed',
  WORKFLOW_FAILED = 'workflow_failed',
  WORKFLOW_CANCELLED = 'workflow_cancelled',
  WORKFLOW_PAUSED = 'workflow_paused',
  WORKFLOW_RESUMED = 'workflow_resumed',
  NODE_STARTED = 'node_started',
  NODE_COMPLETED = 'node_completed',
  NODE_FAILED = 'node_failed',
  NODE_RETRYING = 'node_retrying',
  NODE_SKIPPED = 'node_skipped',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  TASK_TIMED_OUT = 'task_timed_out',
  HUMAN_APPROVAL_REQUESTED = 'human_approval_requested',
  HUMAN_APPROVAL_RECEIVED = 'human_approval_received',
  HUMAN_APPROVAL_ESCALATED = 'human_approval_escalated',
  PAYMENT_ALLOCATED = 'payment_allocated',
  PAYMENT_RELEASED = 'payment_released',
  PAYMENT_ROLLED_BACK = 'payment_rolled_back',
  COMPENSATION_STARTED = 'compensation_started',
  COMPENSATION_COMPLETED = 'compensation_completed',
  COMPENSATION_FAILED = 'compensation_failed',
  BRANCH_STARTED = 'branch_started',
  BRANCH_COMPLETED = 'branch_completed',
  JOIN_WAITING = 'join_waiting',
  JOIN_COMPLETED = 'join_completed',
  CIRCUIT_BREAKER_OPENED = 'circuit_breaker_opened',
  CIRCUIT_BREAKER_CLOSED = 'circuit_breaker_closed',
  CIRCUIT_BREAKER_HALF_OPEN = 'circuit_breaker_half_open',
}

// ============================================================================
// Workflow Definition Types
// ============================================================================

export type WorkflowNodeType = 
  | 'agent'        // Agent execution node
  | 'human'        // Human approval/interaction node
  | 'condition'    // Conditional branching
  | 'parallel'     // Parallel execution
  | 'join'         // Join parallel branches
  | 'delay'        // Delay/timer node
  | 'subworkflow'; // Nested workflow

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  description?: string;
  
  // Agent-specific configuration
  agentConfig?: {
    agentId?: string;           // Specific agent or null for dynamic resolution
    agentRole?: string;         // Role-based agent selection
    minReputation?: number;     // Minimum reputation score
    timeoutMs: number;          // Execution timeout
    maxRetries: number;         // Retry attempts
    fallbackAgents?: string[];  // Backup agents if primary fails
  };
  
  // Human node configuration
  humanConfig?: {
    approvalType: 'single' | 'majority' | 'unanimous';
    approvers: string[];        // List of required approver IDs
    timeoutMs: number;
    reminderIntervalMs?: number;
  };
  
  // Condition configuration
  conditionConfig?: {
    expression: string;         // JavaScript expression or JSON logic
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'regex';
    field: string;              // Field to evaluate in result
    value: any;                 // Value to compare against
  };
  
  // Parallel configuration
  parallelConfig?: {
    branches: string[][];       // Array of node ID arrays (parallel branches)
    joinMode: 'all' | 'any' | 'n'; // How to complete
    joinN?: number;             // If mode is 'n', how many required
  };
  
  // Delay configuration
  delayConfig?: {
    durationMs: number;
    orUntilEvent?: string;      // Can also wake on event
  };
  
  // Subworkflow configuration
  subworkflowConfig?: {
    workflowId: string;         // Reference to another workflow
    inputMapping: Record<string, string>; // Map inputs
  };
  
  // Payment allocation for this node
  paymentConfig?: {
    baseAmount: number;         // Base payment in tokens
    reputationBonus: boolean;   // Add reputation-based bonus
    escrowPercent: number;      // Hold in escrow until completion
  };
  
  // Position for visualization
  position?: { x: number; y: number };
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  from: string;                 // Source node ID
  to: string;                   // Target node ID
  label?: string;
  condition?: string;           // Condition for this edge (for branching)
  priority?: number;            // Edge priority (for multiple valid paths)
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  
  // Graph structure
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  
  // Entry and exit points
  startNodeId: string;
  endNodeIds?: string[];        // Multiple end nodes allowed
  
  // Global configuration
  globalTimeoutMs?: number;
  maxConcurrentNodes?: number;
  defaultRetryPolicy?: RetryPolicy;
  
  // Access control
  ownerId: string;
  allowedAgentIds?: string[];
  
  // Payment configuration
  budgetLimit?: number;
  paymentToken?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  nodes: Omit<WorkflowNode, 'id'>[];
  edges: Omit<WorkflowEdge, 'id'>[];
  startNodeId?: string;
  globalTimeoutMs?: number;
  maxConcurrentNodes?: number;
  defaultRetryPolicy?: RetryPolicy;
  budgetLimit?: number;
  paymentToken?: string;
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

export type ExecutionStatus = 
  | 'pending'      // Waiting to start
  | 'running'      // Currently executing
  | 'paused'       // Paused by user/system
  | 'waiting_human' // Waiting for human approval
  | 'waiting_agent' // Waiting for agent response
  | 'completed'    // Successfully finished
  | 'failed'       // Failed and no retries left
  | 'cancelled'    // Cancelled by user
  | 'compensating' // Running compensation (Saga)
  | 'compensated'; // Compensation complete

export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface NodeExecution {
  nodeId: string;
  status: NodeExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  result?: TaskResult;
  error?: Error;
  compensationData?: any;       // Data needed for compensation
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  
  status: ExecutionState;
  
  // Execution state
  currentNodeId?: string;
  completedNodeIds: string[];
  nodeExecutions: Map<string, NodeExecution>;
  
  // Input/output
  input: any;
  output?: any;
  context: ExecutionContext;
  
  // Parallel execution tracking
  activeBranches: Set<string>;
  pendingJoins: Map<string, string[]>; // joinNodeId -> waiting branch nodeIds
  
  // Progress tracking
  startedAt: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;
  progressPercent: number;
  
  // Payment tracking
  budgetAllocated: number;
  budgetSpent: number;
  payments: PaymentRecord[];
  
  // Event sourcing
  events: ExecutionEvent[];
  
  // Retry and circuit breaker state
  retryCount: Map<string, number>;
  circuitBreakerStates: Map<string, CircuitBreakerState>;
  
  // Human-in-the-loop
  humanInLoopConfig?: HumanInLoopConfig;
  pendingApprovals?: string[];
  
  // Metrics and observability
  metrics?: ExecutionMetrics;
}

export interface ExecutionMetrics {
  totalNodeExecutions: number;
  failedNodeExecutions: number;
  retriedNodeExecutions: number;
  totalLatencyMs: number;
  avgNodeLatencyMs: number;
  maxNodeLatencyMs: number;
  totalTokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  totalCost: {
    amount: number;
    currency: string;
  };
  agentUtilization: Map<string, number>;
}

export interface ExecutionContext {
  requesterId: string;
  conversationId?: string;
  parentExecutionId?: string;   // For subworkflows
  priority: 1 | 2 | 3 | 4 | 5;
  metadata: Record<string, any>;
}

export interface ExecutionStateSnapshot {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNodeId?: string;
  currentNodeName?: string;
  progressPercent: number;
  startedAt: Date;
  estimatedCompletionAt?: Date;
  timeElapsedMs: number;
  timeRemainingMs?: number;
  budgetSpent: number;
  budgetLimit?: number;
  activeBranches: number;
  completedNodes: number;
  totalNodes: number;
  recentEvents: WorkflowEvent[];
}

// ============================================================================
// Agent Task Types
// ============================================================================

export interface AgentTask {
  id: string;
  executionId: string;
  nodeId: string;
  
  // Task specification
  agentId?: string;
  agentRole?: string;
  taskType: string;
  input: any;
  context: TaskContext;
  requirements?: TaskRequirements;
  
  // Payment
  payment: TaskPayment;
  
  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  deadlineAt?: Date;
  expiresAt?: Date;             // Task expiration if not assigned
  
  // Status
  status: TaskStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  result?: TaskResult;
  
  // Assignment tracking
  assignedTo?: string;
  assignedAt?: Date;
  previousAssignments?: string[];
}

export interface TaskRequirements {
  minReputation?: number;
  requiredSkills?: string[];
  requiredCapabilities?: string[];
  excludeAgents?: string[];     // Blacklist specific agents
  preferredAgents?: string[];   // Whitelist preferred agents
  maxCost?: number;
  maxLatencyMs?: number;
}

export type TaskStatusLegacy = 
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface TaskContext {
  workflowId: string;
  executionId: string;
  nodeId: string;
  conversationId?: string;
  previousResults: Record<string, any>;
  executionContext: ExecutionContext;
}

export interface TaskPayment {
  baseAmount: number;
  reputationBonus: number;
  escrowAmount: number;
  token: string;
  released: boolean;
  releasedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  error?: TaskError;
  metadata: TaskResultMetadata;
  reasoning?: ReasoningTrace;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  summary?: string;
  confidence?: number;
  alternativesConsidered?: string[];
}

export interface ReasoningStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
  timestamp: Date;
}

export interface TaskError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface TaskResultMetadata {
  agentId: string;
  startedAt: Date;
  completedAt: Date;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  costEstimate?: {
    amount: number;
    currency: string;
    breakdown?: Record<string, number>;
  };
  latencyMs?: number;
  reputationDelta?: number;
  version?: string;
  model?: string;
}

// ============================================================================
// Event Sourcing Types
// ============================================================================

export type WorkflowEventType =
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'execution_paused'
  | 'execution_resumed'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_retrying'
  | 'node_skipped'
  | 'human_approval_requested'
  | 'human_approval_received'
  | 'payment_allocated'
  | 'payment_released'
  | 'payment_rolled_back'
  | 'compensation_started'
  | 'compensation_completed'
  | 'compensation_failed'
  | 'branch_started'
  | 'branch_completed'
  | 'join_waiting'
  | 'join_completed';

export interface WorkflowEvent {
  id: string;
  executionId: string;
  type: WorkflowEventType;
  timestamp: Date;
  nodeId?: string;
  payload: any;
  correlationId?: string;
}

export interface ExecutionEvent {
  id: string;
  executionId: string;
  type: EventType;
  timestamp: Date;
  nodeId?: string;
  taskId?: string;
  agentId?: string;
  payload: Record<string, any>;
  correlationId?: string;
  causationId?: string;         // Previous event that caused this
  metadata?: {
    source?: string;
    version?: string;
    [key: string]: any;
  };
}

// ============================================================================
// Retry and Circuit Breaker Types
// ============================================================================

export interface RetryPolicy {
  maxAttempts: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];   // Error codes that trigger retry
  jitter?: boolean;             // Add random jitter to backoff
  jitterMaxMs?: number;         // Maximum jitter in ms
  onRetry?: string;             // Callback action on retry
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  openedAt?: Date;
  halfOpenedAt?: Date;
  nextAttemptAt?: Date;         // When to attempt half-open
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Failures before opening
  successThreshold: number;     // Successes before closing from half-open
  timeoutMs: number;            // Time before attempting half-open
  halfOpenMaxCalls?: number;    // Max calls allowed in half-open state
}

// ============================================================================
// Payment and Compensation Types
// ============================================================================

export interface PaymentRecord {
  id: string;
  taskId: string;
  nodeId: string;
  agentId: string;
  amount: number;
  token: string;
  status: 'allocated' | 'held' | 'released' | 'rolled_back';
  allocatedAt: Date;
  releasedAt?: Date;
}

export interface CompensationAction {
  id: string;
  nodeId: string;
  actionType: 'rollback_payment' | 'notify' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  input: any;
  result?: any;
}

// ============================================================================
// Human Approval Types
// ============================================================================

export interface HumanApprovalRequest {
  id: string;
  executionId: string;
  nodeId: string;
  requesterId: string;
  approvers: string[];
  approvalType: 'single' | 'majority' | 'unanimous';
  context: any;
  requestedAt: Date;
  timeoutAt: Date;
}

export interface HumanApprovalDecision {
  requestId: string;
  approverId: string;
  decision: 'approve' | 'reject' | 'request_changes';
  comments?: string;
  timestamp: Date;
}

export interface HumanInLoopConfig {
  approvalPoints: ApprovalPoint[];
  escalationPolicy?: EscalationPolicy;
  defaultTimeoutMs: number;
  reminderIntervalMs?: number;
  autoApproveOnTimeout?: boolean;
  requireJustification?: boolean;
  auditLevel?: 'none' | 'basic' | 'full';
}

export interface ApprovalPoint {
  id: string;
  name: string;
  description?: string;
  triggerCondition?: string;    // Expression to trigger this approval
  approvers: string[];          // User IDs or role references
  approvalType: 'single' | 'majority' | 'unanimous';
  timeoutMs: number;
  escalationPath?: string[];    // Escalation user IDs in order
}

export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
  autoEscalateOnTimeout: boolean;
  maxEscalationLevels: number;
  notifyOnEscalation: boolean;
}

export interface EscalationLevel {
  level: number;
  approvers: string[];
  timeoutMs: number;
  notificationChannels?: ('email' | 'slack' | 'sms' | 'push')[];
}

// ============================================================================
// Scheduler Configuration
// ============================================================================

export interface SchedulerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  clawBus: ClawBusIntegration;
  clawKernel: ClawKernelIntegration;
  defaultRetryPolicy: RetryPolicy;
  circuitBreakerConfig: CircuitBreakerConfig;
  maxConcurrentExecutions: number;
  pollIntervalMs: number;
  eventRetentionDays: number;
}

export interface ClawBusIntegration {
  send(message: any): Promise<void>;
  broadcast(channel: string, payload: any): Promise<void>;
  poll(agentId: string): Promise<any[]>;
}

export interface ClawKernelIntegration {
  spawn(config: any): Promise<any>;
  kill(processId: string): Promise<void>;
  getStatus(processId: string): Promise<any>;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}
