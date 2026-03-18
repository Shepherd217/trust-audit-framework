/**
 * ============================================================================
 * ClawKernel - Agent Process Manager Types
 * ============================================================================
 * 
 * Type definitions for the MoltOS process management system.
 * This is the "container runtime" for agent processes.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Core Process Types
// ============================================================================

/** Process status lifecycle states */
export type ProcessStatus = 
  | 'spawning' 
  | 'running' 
  | 'paused' 
  | 'crashed' 
  | 'killed'
  | 'restarting';

/** Agent process definition */
export interface AgentProcess {
  /** Unique process ID */
  id: string;
  /** Associated agent ID */
  agentId: string;
  /** Current process status */
  status: ProcessStatus;
  /** Operating system process ID */
  pid?: number;
  /** Resource limits and current allocation */
  resources: {
    /** CPU limit as percentage (0-100) */
    cpuPercent: number;
    /** Memory limit in MB */
    memoryMB: number;
    /** Network rate limit in KB/s (optional) */
    networkRate?: number;
  };
  /** Process start timestamp */
  startedAt: Date;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Number of times this process has been restarted */
  restartCount: number;
  /** Process command configuration */
  command?: string;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Process exit code (if exited) */
  exitCode?: number;
  /** Error message (if crashed) */
  errorMessage?: string;
}

/** Process spawn configuration */
export interface SpawnConfig {
  /** Agent ID to spawn */
  agentId: string;
  /** Optional custom process ID */
  processId?: string;
  /** Command to execute (defaults to node) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Resource limits */
  resources?: {
    cpuPercent?: number;
    memoryMB?: number;
    networkRate?: number;
  };
  /** Auto-restart configuration */
  restartPolicy?: RestartPolicy;
}

/** Auto-restart policy configuration */
export interface RestartPolicy {
  /** Enable auto-restart (default: true) */
  enabled: boolean;
  /** Maximum restarts per hour (default: 5) */
  maxRestartsPerHour: number;
  /** Initial backoff delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Maximum backoff delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
}

/** Default restart policy */
export const DEFAULT_RESTART_POLICY: RestartPolicy = {
  enabled: true,
  maxRestartsPerHour: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/** Health monitoring configuration */
export interface HealthConfig {
  /** Heartbeat interval in seconds (default: 30) */
  heartbeatIntervalSec: number;
  /** Missed heartbeats before marking as crashed (default: 3) */
  missedHeartbeatsBeforeCrash: number;
  /** Enable auto-restart on crash (default: true) */
  autoRestart: boolean;
}

/** Default health configuration */
export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  heartbeatIntervalSec: 30,
  missedHeartbeatsBeforeCrash: 3,
  autoRestart: true,
};

// ============================================================================
// Kernel Events
// ============================================================================

/** Process lifecycle events */
export interface KernelEvents {
  /** Emitted when a process is being spawned */
  'process:spawning': { processId: string; agentId: string; config: SpawnConfig };
  /** Emitted when a process has started running */
  'process:spawned': { processId: string; agentId: string; pid: number };
  /** Emitted when a process is paused */
  'process:paused': { processId: string; agentId: string };
  /** Emitted when a process is resumed */
  'process:resumed': { processId: string; agentId: string };
  /** Emitted when a process is killed */
  'process:killed': { processId: string; agentId: string; signal: string };
  /** Emitted when a process crashes */
  'process:crashed': { processId: string; agentId: string; error: string; exitCode?: number };
  /** Emitted when a process is being restarted */
  'process:restarting': { processId: string; agentId: string; attempt: number };
  /** Emitted when a process heartbeat is received */
  'process:heartbeat': { processId: string; agentId: string; timestamp: Date };
  /** Emitted when a process misses heartbeats */
  'process:unhealthy': { processId: string; agentId: string; missedHeartbeats: number };
  /** Emitted when resource limits are exceeded */
  'process:resource_limit': { 
    processId: string; 
    agentId: string; 
    resource: 'cpu' | 'memory' | 'network';
    current: number;
    limit: number;
  };
}

// ============================================================================
// API Types
// ============================================================================

/** Spawn request body */
export interface SpawnRequest {
  agentId: string;
  processId?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cpu?: number;
  memory?: number;
  networkRate?: number;
  restartPolicy?: Partial<RestartPolicy>;
}

/** Spawn response */
export interface SpawnResponse {
  success: boolean;
  processId: string;
  agentId: string;
  pid: number;
  status: ProcessStatus;
  startedAt: string;
}

/** Status response */
export interface StatusResponse {
  success: boolean;
  process: AgentProcessDTO;
}

/** List response */
export interface ListResponse {
  success: boolean;
  processes: AgentProcessDTO[];
  total: number;
  running: number;
  paused: number;
  crashed: number;
}

/** Agent process DTO for API responses */
export interface AgentProcessDTO {
  id: string;
  agentId: string;
  status: ProcessStatus;
  pid?: number;
  resources: {
    cpuPercent: number;
    memoryMB: number;
    networkRate?: number;
  };
  startedAt: string;
  lastHeartbeat: string;
  restartCount: number;
  uptime?: number; // milliseconds
}

/** Generic action response */
export interface ActionResponse {
  success: boolean;
  processId: string;
  action: 'kill' | 'pause' | 'resume';
  previousStatus: ProcessStatus;
  currentStatus: ProcessStatus;
}

/** Error response */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/** Internal process handle with runtime state */
export interface ProcessHandle extends AgentProcess {
  /** Node.js ChildProcess instance */
  childProcess?: any; // ChildProcess from child_process module
  /** Restart tracking */
  restartHistory: Date[];
  /** Next allowed restart time (for backoff) */
  nextRestartTime?: Date;
  /** Health check interval handle */
  healthCheckInterval?: NodeJS.Timeout;
  /** Resource monitoring interval handle */
  resourceMonitorInterval?: NodeJS.Timeout;
  /** Promise resolvers for wait operations */
  waitResolvers: Array<(exitCode: number) => void>;
  /** Process stdout buffer */
  stdoutBuffer: string[];
  /** Process stderr buffer */
  stderrBuffer: string[];
}

/** Resource usage snapshot */
export interface ResourceSnapshot {
  timestamp: Date;
  cpuPercent: number;
  memoryMB: number;
  networkKBps?: number;
}

/** Kernel configuration options */
export interface KernelOptions {
  /** Health monitoring configuration */
  health?: Partial<HealthConfig>;
  /** Global process limits */
  limits?: {
    maxProcesses?: number;
    totalMemoryMB?: number;
    totalCpuPercent?: number;
  };
  /** Serverless mode (affects persistence) */
  serverless?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/** Kernel statistics */
export interface KernelStats {
  totalProcesses: number;
  runningProcesses: number;
  pausedProcesses: number;
  crashedProcesses: number;
  killedProcesses: number;
  totalRestarts: number;
  averageUptime: number;
  resourceUsage: {
    totalMemoryMB: number;
    totalCpuPercent: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

/** Kernel error codes */
export type KernelErrorCode =
  | 'PROCESS_NOT_FOUND'
  | 'PROCESS_EXISTS'
  | 'SPAWN_FAILED'
  | 'KILL_FAILED'
  | 'PAUSE_FAILED'
  | 'RESUME_FAILED'
  | 'RESOURCE_EXCEEDED'
  | 'MAX_PROCESSES_REACHED'
  | 'INVALID_CONFIG'
  | 'SERVERLESS_LIMITATION'
  | 'INTERNAL_ERROR';

/** Kernel error class */
export class KernelError extends Error {
  constructor(
    message: string,
    public readonly code: KernelErrorCode,
    public readonly processId?: string
  ) {
    super(message);
    this.name = 'KernelError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/** Convert AgentProcess to DTO */
export function toProcessDTO(process: AgentProcess): AgentProcessDTO {
  const now = new Date();
  const uptime = now.getTime() - process.startedAt.getTime();
  
  return {
    id: process.id,
    agentId: process.agentId,
    status: process.status,
    pid: process.pid,
    resources: process.resources,
    startedAt: process.startedAt.toISOString(),
    lastHeartbeat: process.lastHeartbeat.toISOString(),
    restartCount: process.restartCount,
    uptime: process.status === 'running' || process.status === 'paused' ? uptime : undefined,
  };
}

/** Generate unique process ID */
export function generateProcessId(agentId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${agentId}-${timestamp}-${random}`;
}

/** Validate spawn configuration */
export function validateSpawnConfig(config: SpawnRequest): void {
  if (!config.agentId || config.agentId.trim() === '') {
    throw new KernelError('agentId is required', 'INVALID_CONFIG');
  }
  
  if (config.cpu !== undefined && (config.cpu < 0 || config.cpu > 100)) {
    throw new KernelError('cpu must be between 0 and 100', 'INVALID_CONFIG');
  }
  
  if (config.memory !== undefined && config.memory < 1) {
    throw new KernelError('memory must be at least 1 MB', 'INVALID_CONFIG');
  }
  
  if (config.networkRate !== undefined && config.networkRate < 0) {
    throw new KernelError('networkRate must be non-negative', 'INVALID_CONFIG');
  }
}


// ============================================================================
// Missing Types (Added for compatibility)
// ============================================================================

/** Process configuration for spawning */
export interface ProcessConfig {
  agentId: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cpu?: number;
  memory?: number;
  networkRate?: number;
  workingDirectory?: string;
}

/** Process information summary */
export interface ProcessInfo {
  id: string;
  agentId?: string;
  name: string;
  status: string;
  pid?: number;
  cpu?: number;
  memory?: number;
  uptime?: number;
  restartCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastHeartbeat?: string;
  config?: ProcessConfig;
}
