/**
 * ClawScheduler - Task Orchestration Engine for MoltOS
 * 
 * A production-grade workflow engine featuring:
 * - DAG-based workflow execution with cycle detection
 * - Parallel task execution with dependency resolution
 * - Automatic retries with exponential backoff
 * - Redis-backed task queue with priorities
 * - Intelligent agent assignment with skill matching
 * - Real-time monitoring and bottleneck detection
 */

// ============================================================================
// TYPES
// ============================================================================

/** Unique identifier for tasks and workflows */
export type TaskId = string;
export type WorkflowId = string;
export type AgentId = string;

/** Task execution status */
export enum TaskStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/** Workflow execution status */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

/** Priority levels for tasks */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/** Task definition */
export interface Task {
  id: TaskId;
  name: string;
  description?: string;
  type: string;
  payload: unknown;
  dependencies: TaskId[];
  priority: TaskPriority;
  
  // Execution config
  timeout?: number;           // Timeout in milliseconds
  maxRetries?: number;        // Maximum retry attempts
  retryDelay?: number;        // Initial retry delay in ms
  retryBackoff?: 'fixed' | 'linear' | 'exponential';
  
  // Scheduling
  scheduledAt?: Date;         // Delayed execution
  cron?: string;              // Recurring schedule
  
  // Agent requirements
  requiredSkills?: string[];
  preferredAgents?: AgentId[];
  excludedAgents?: AgentId[];
  
  // Metadata
  createdAt: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Workflow definition - a DAG of tasks */
export interface Workflow {
  id: WorkflowId;
  name: string;
  description?: string;
  tasks: Map<TaskId, Task>;
  edges: Map<TaskId, TaskId[]>; // adjacency list: task -> dependents
  
  // Global settings
  globalTimeout?: number;
  defaultMaxRetries?: number;
  concurrencyLimit?: number;
  
  // Metadata
  createdAt: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Agent capability profile */
export interface Agent {
  id: AgentId;
  name: string;
  skills: Map<string, number>; // skill -> proficiency (0-1)
  capacity: number;             // Max concurrent tasks
  currentLoad: number;          // Current active tasks
  
  // Performance metrics
  successRate: number;
  avgExecutionTime: number;
  reputation: number;           // 0-1 composite score
  
  // Status
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  lastHeartbeat: Date;
  
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Task execution result */
export interface TaskResult {
  taskId: TaskId;
  workflowId: WorkflowId;
  status: TaskStatus;
  agentId?: AgentId;
  output?: unknown;
  error?: string;
  startedAt: Date;
  completedAt: Date;
  retries: number;
  logs: string[];
}

/** Workflow execution state */
export interface WorkflowExecution {
  id: string;
  workflowId: WorkflowId;
  status: WorkflowStatus;
  taskStates: Map<TaskId, TaskState>;
  startedAt: Date;
  completedAt?: Date;
  progress: number; // 0-100
}

/** Individual task state within a workflow execution */
export interface TaskState {
  task: Task;
  status: TaskStatus;
  result?: TaskResult;
  startedAt?: Date;
  completedAt?: Date;
  assignedAgent?: AgentId;
  attempts: number;
}

/** Queue message structure */
export interface QueueMessage {
  id: string;
  task: Task;
  workflowId: WorkflowId;
  priority: TaskPriority;
  enqueuedAt: Date;
  attempts: number;
  visibleAt: number; // Unix timestamp when task becomes visible
}

/** Monitoring metrics */
export interface SchedulerMetrics {
  // Queue metrics
  queueDepth: number;
  tasksEnqueued: number;
  tasksDequeued: number;
  
  // Execution metrics
  tasksRunning: number;
  tasksCompleted: number;
  tasksFailed: number;
  
  // Performance metrics
  avgQueueTime: number;
  avgExecutionTime: number;
  throughput: number; // tasks/sec
  
  // Agent metrics
  activeAgents: number;
  agentUtilization: number;
  
  // Bottlenecks
  bottlenecks: Bottleneck[];
}

/** Detected bottleneck */
export interface Bottleneck {
  type: 'agent' | 'task' | 'dependency' | 'queue';
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedTasks: TaskId[];
  recommendedAction: string;
}

/** Scheduler configuration */
export interface SchedulerConfig {
  // Redis connection
  redisUrl: string;
  redisPrefix?: string;
  
  // Execution settings
  maxConcurrency: number;
  defaultTimeout: number;
  defaultMaxRetries: number;
  
  // Retry settings
  retryBackoff: 'fixed' | 'linear' | 'exponential';
  maxRetryDelay: number;
  
  // Agent settings
  agentTimeout: number;
  heartbeatInterval: number;
  
  // Monitoring
  metricsInterval: number;
  bottleneckThreshold: number;
}

// ============================================================================
// ERRORS
// ============================================================================

export class SchedulerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SchedulerError';
  }
}

export class WorkflowCycleError extends SchedulerError {
  constructor(cycle: TaskId[]) {
    super(`Workflow contains cycle: ${cycle.join(' -> ')}`, 'WORKFLOW_CYCLE');
    this.name = 'WorkflowCycleError';
  }
}

export class TaskNotFoundError extends SchedulerError {
  constructor(taskId: TaskId) {
    super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    this.name = 'TaskNotFoundError';
  }
}

export class AgentNotAvailableError extends SchedulerError {
  constructor(message: string) {
    super(message, 'AGENT_NOT_AVAILABLE');
    this.name = 'AgentNotAvailableError';
  }
}

export class WorkflowTimeoutError extends SchedulerError {
  constructor(workflowId: WorkflowId) {
    super(`Workflow timed out: ${workflowId}`, 'WORKFLOW_TIMEOUT');
    this.name = 'WorkflowTimeoutError';
  }
}
