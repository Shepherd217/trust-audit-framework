/**
 * ClawKernel - Process Management Module
 * Core process orchestration for MoltOS
 * 
 * Features:
 * - Agent lifecycle management (spawn/monitor/kill)
 * - Resource limits and quotas
 * - Auto-restart with exponential backoff
 * - Process isolation and cleanup
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProcessConfig {
  id?: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  /** Maximum memory in MB */
  memoryLimit?: number;
  /** Maximum CPU percentage (0-100) */
  cpuLimit?: number;
  /** Maximum execution time in ms (0 = unlimited) */
  timeout?: number;
  /** Auto-restart configuration */
  restartPolicy?: RestartPolicy;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
  /** Priority level (0-10, lower = higher priority) */
  priority?: number;
}

export interface RestartPolicy {
  /** Maximum number of restart attempts */
  maxAttempts: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Only restart on non-zero exit codes */
  onlyOnFailure?: boolean;
}

export interface SandboxConfig {
  /** Allowed file system paths (empty = no restrictions) */
  allowedPaths?: string[];
  /** Blocked file system paths */
  blockedPaths?: string[];
  /** Allowed network destinations */
  allowedNetworks?: string[];
  /** Block network access entirely */
  noNetwork?: boolean;
  /** Run as unprivileged user */
  dropPrivileges?: boolean;
  /** Resource namespace isolation */
  isolateResources?: boolean;
}

export interface ProcessStats {
  pid: string;
  status: ProcessStatus;
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  restartCount: number;
  memoryUsage: number; // MB
  cpuUsage: number;    // Percentage
  totalCpuTime: number; // ms
}

export enum ProcessStatus {
  PENDING = 'pending',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  CRASHED = 'crashed',
  RESTARTING = 'restarting',
  OOM_KILLED = 'oom_killed',
  TIMEOUT = 'timeout',
}

export interface ProcessHandle {
  readonly id: string;
  readonly config: ProcessConfig;
  readonly stats: ProcessStats;
  kill(signal?: NodeJS.Signals): Promise<boolean>;
  restart(): Promise<boolean>;
  wait(): Promise<number>;
  sendMessage(message: unknown): boolean;
}

// ============================================================================
// Errors
// ============================================================================

export class ProcessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly processId?: string
  ) {
    super(message);
    this.name = 'ProcessError';
  }
}

// ============================================================================
// Process Manager
// ============================================================================

interface InternalProcess extends ProcessHandle {
  process: any; // ChildProcess
  restartAttempts: number;
  restartTimer?: NodeJS.Timeout;
  memoryCheckInterval?: NodeJS.Timeout;
  cpuCheckInterval?: NodeJS.Timeout;
  startTime: number;
  resolveWait?: (exitCode: number) => void;
  rejectWait?: (error: Error) => void;
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, InternalProcess>();
  private readonly defaultRestartPolicy: RestartPolicy = {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    onlyOnFailure: true,
  };

  constructor(
    private readonly globalLimits: {
      maxProcesses?: number;
      totalMemoryLimit?: number;
      totalCpuLimit?: number;
    } = {}
  ) {
    super();
    this.setupGlobalMonitoring();
  }

  // ========================================================================
  // Process Lifecycle
  // ========================================================================

  /**
   * Spawn a new agent process with resource limits and monitoring
   */
  async spawn(config: ProcessConfig): Promise<ProcessHandle> {
    // Validate and check limits
    this.validateConfig(config);
    await this.checkGlobalLimits();

    const id = config.id || randomUUID();
    
    if (this.processes.has(id)) {
      throw new ProcessError(
        `Process with ID ${id} already exists`,
        'PROCESS_EXISTS',
        id
      );
    }

    const fullConfig: ProcessConfig = {
      ...config,
      id,
      restartPolicy: config.restartPolicy || this.defaultRestartPolicy,
      priority: config.priority ?? 5,
    };

    this.emit('process:spawning', { id, config: fullConfig });

    const processHandle = await this.createProcess(fullConfig);
    this.processes.set(id, processHandle);

    this.emit('process:spawned', { id, config: fullConfig });
    
    return processHandle;
  }

  /**
   * Kill a process gracefully, then forcefully if needed
   */
  async kill(processId: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
    const proc = this.processes.get(processId);
    if (!proc) {
      throw new ProcessError(
        `Process ${processId} not found`,
        'PROCESS_NOT_FOUND',
        processId
      );
    }

    if (proc.stats.status === ProcessStatus.STOPPED || 
        proc.stats.status === ProcessStatus.CRASHED) {
      return true;
    }

    this.emit('process:killing', { id: processId, signal });
    proc.stats.status = ProcessStatus.STOPPING;

    // Clear any pending restart
    if (proc.restartTimer) {
      clearTimeout(proc.restartTimer);
      proc.restartTimer = undefined;
    }

    // Try graceful shutdown first
    const killed = await this.killProcess(proc, signal);
    
    if (!killed) {
      // Force kill after timeout
      setTimeout(() => {
        if (proc.process && !proc.process.killed) {
          this.killProcess(proc, 'SIGKILL');
        }
      }, 5000);
    }

    return killed;
  }

  /**
   * Restart a process
   */
  async restart(processId: string): Promise<boolean> {
    const proc = this.processes.get(processId);
    if (!proc) {
      throw new ProcessError(
        `Process ${processId} not found`,
        'PROCESS_NOT_FOUND',
        processId
      );
    }

    this.emit('process:restarting', { id: processId });
    
    // Kill existing process
    await this.kill(processId, 'SIGTERM');
    
    // Reset restart counter for manual restart
    proc.restartAttempts = 0;
    
    // Recreate process
    const newHandle = await this.createProcess(proc.config);
    this.processes.set(processId, newHandle);
    
    return true;
  }

  /**
   * Get process handle by ID
   */
  getProcess(processId: string): ProcessHandle | undefined {
    return this.processes.get(processId);
  }

  /**
   * List all managed processes
   */
  listProcesses(): ProcessHandle[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by status
   */
  getProcessesByStatus(status: ProcessStatus): ProcessHandle[] {
    return this.listProcesses().filter(p => p.stats.status === status);
  }

  /**
   * Terminate all processes gracefully
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    this.emit('shutdown:starting', { processCount: this.processes.size });
    
    const shutdownPromises = Array.from(this.processes.keys()).map(async (id) => {
      try {
        await Promise.race([
          this.kill(id, 'SIGTERM'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs)
          ),
        ]);
      } catch (error) {
        // Force kill on timeout
        await this.kill(id, 'SIGKILL');
      }
    });

    await Promise.all(shutdownPromises);
    this.processes.clear();
    
    this.emit('shutdown:complete');
  }

  // ========================================================================
  // Private Implementation
  // ========================================================================

  private validateConfig(config: ProcessConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new ProcessError('Process name is required', 'INVALID_CONFIG');
    }
    if (!config.command || config.command.trim().length === 0) {
      throw new ProcessError('Command is required', 'INVALID_CONFIG');
    }
    if (config.memoryLimit !== undefined && config.memoryLimit <= 0) {
      throw new ProcessError('Memory limit must be positive', 'INVALID_CONFIG');
    }
    if (config.cpuLimit !== undefined && (config.cpuLimit < 0 || config.cpuLimit > 100)) {
      throw new ProcessError('CPU limit must be between 0 and 100', 'INVALID_CONFIG');
    }
  }

  private async checkGlobalLimits(): Promise<void> {
    const { maxProcesses, totalMemoryLimit, totalCpuLimit } = this.globalLimits;
    
    if (maxProcesses !== undefined && this.processes.size >= maxProcesses) {
      throw new ProcessError(
        `Maximum process limit (${maxProcesses}) reached`,
        'GLOBAL_LIMIT_EXCEEDED'
      );
    }

    if (totalMemoryLimit !== undefined) {
      const totalMemory = Array.from(this.processes.values())
        .reduce((sum, p) => sum + p.stats.memoryUsage, 0);
      if (totalMemory >= totalMemoryLimit) {
        throw new ProcessError(
          `Global memory limit (${totalMemoryLimit}MB) exceeded`,
          'GLOBAL_LIMIT_EXCEEDED'
        );
      }
    }
  }

  private async createProcess(config: ProcessConfig): Promise<InternalProcess> {
    const { spawn } = await import('child_process');
    
    const stats: ProcessStats = {
      pid: config.id!,
      status: ProcessStatus.STARTING,
      startTime: new Date(),
      restartCount: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      totalCpuTime: 0,
    };

    const proc: Partial<InternalProcess> = {
      id: config.id!,
      config,
      stats,
      restartAttempts: 0,
    };

    // Spawn the process with sandboxing
    const env = this.buildEnvironment(config);
    const spawnOptions = {
      cwd: config.cwd,
      env,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'] as const,
    };

    try {
      proc.process = spawn(config.command, config.args || [], spawnOptions);
      stats.status = ProcessStatus.RUNNING;
      
      // Set up process event handlers
      this.setupProcessHandlers(proc as InternalProcess);
      
      // Set up resource monitoring
      if (config.memoryLimit || config.cpuLimit) {
        this.setupResourceMonitoring(proc as InternalProcess);
      }

      // Apply sandbox if configured
      if (config.sandbox) {
        await this.applySandbox(proc as InternalProcess, config.sandbox);
      }

    } catch (error) {
      stats.status = ProcessStatus.CRASHED;
      throw new ProcessError(
        `Failed to spawn process: ${error}`,
        'SPAWN_FAILED',
        config.id
      );
    }

    return proc as InternalProcess;
  }

  private buildEnvironment(config: ProcessConfig): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLAW_PROCESS_ID: config.id,
      CLAW_PROCESS_NAME: config.name,
      ...config.env,
    };

    // Apply sandbox environment restrictions
    if (config.sandbox?.noNetwork) {
      env.CLAW_NETWORK_DISABLED = '1';
    }

    return env;
  }

  private setupProcessHandlers(proc: InternalProcess): void {
    const { process, config, stats } = proc;

    process.on('error', (error: Error) => {
      this.emit('process:error', { id: config.id, error });
      this.handleProcessExit(proc, null, error);
    });

    process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.handleProcessExit(proc, code, signal);
    });

    // Handle IPC messages
    process.on('message', (message: unknown) => {
      this.emit('process:message', { id: config.id, message });
    });

    // Handle stdout/stderr
    process.stdout?.on('data', (data: Buffer) => {
      this.emit('process:stdout', { id: config.id, data: data.toString() });
    });

    process.stderr?.on('data', (data: Buffer) => {
      this.emit('process:stderr', { id: config.id, data: data.toString() });
    });

    // Handle timeout
    if (config.timeout && config.timeout > 0) {
      setTimeout(() => {
        if (stats.status === ProcessStatus.RUNNING) {
          stats.status = ProcessStatus.TIMEOUT;
          this.kill(config.id!, 'SIGTERM');
        }
      }, config.timeout);
    }
  }

  private handleProcessExit(
    proc: InternalProcess,
    code: number | null,
    signal: NodeJS.Signals | Error | null
  ): void {
    const { config, stats } = proc;
    
    // Clean up monitoring
    if (proc.memoryCheckInterval) clearInterval(proc.memoryCheckInterval);
    if (proc.cpuCheckInterval) clearInterval(proc.cpuCheckInterval);

    stats.endTime = new Date();
    stats.exitCode = code ?? undefined;

    // Determine final status
    if (stats.status === ProcessStatus.TIMEOUT) {
      // Already marked as timeout
    } else if (stats.status === ProcessStatus.OOM_KILLED) {
      // Already marked as OOM
    } else if (stats.status === ProcessStatus.STOPPING) {
      stats.status = ProcessStatus.STOPPED;
    } else if (code !== 0 || signal instanceof Error) {
      stats.status = ProcessStatus.CRASHED;
    } else {
      stats.status = ProcessStatus.STOPPED;
    }

    this.emit('process:exit', {
      id: config.id,
      code,
      signal,
      stats: { ...stats },
    });

    // Resolve wait promise
    if (proc.resolveWait) {
      proc.resolveWait(code ?? -1);
    }

    // Handle auto-restart
    if (this.shouldRestart(proc, code)) {
      this.scheduleRestart(proc);
    }
  }

  private shouldRestart(proc: InternalProcess, code: number | null): boolean {
    const { config, stats } = proc;
    const policy = config.restartPolicy!;

    // Don't restart if manually stopped
    if (stats.status === ProcessStatus.STOPPED || 
        stats.status === ProcessStatus.STOPPING) {
      return false;
    }

    // Check max attempts
    if (proc.restartAttempts >= policy.maxAttempts) {
      this.emit('process:max_restarts', { id: config.id, attempts: proc.restartAttempts });
      return false;
    }

    // Only restart on failure if configured
    if (policy.onlyOnFailure && code === 0) {
      return false;
    }

    return true;
  }

  private scheduleRestart(proc: InternalProcess): void {
    const { config } = proc;
    const policy = config.restartPolicy!;
    
    proc.restartAttempts++;
    proc.stats.restartCount++;
    proc.stats.status = ProcessStatus.RESTARTING;

    // Calculate backoff delay
    const delay = Math.min(
      policy.initialDelay * Math.pow(policy.backoffMultiplier, proc.restartAttempts - 1),
      policy.maxDelay
    );

    this.emit('process:restart_scheduled', {
      id: config.id,
      attempt: proc.restartAttempts,
      delay,
    });

    proc.restartTimer = setTimeout(async () => {
      try {
        this.processes.delete(config.id!);
        const newHandle = await this.createProcess(config);
        this.processes.set(config.id!, newHandle);
        this.emit('process:restarted', { id: config.id, attempt: proc.restartAttempts });
      } catch (error) {
        this.emit('process:restart_failed', { id: config.id, error });
      }
    }, delay);
  }

  private setupResourceMonitoring(proc: InternalProcess): void {
    const { config, stats } = proc;

    // Memory monitoring
    if (config.memoryLimit) {
      proc.memoryCheckInterval = setInterval(() => {
        const usage = this.getMemoryUsage(proc);
        stats.memoryUsage = usage;

        if (usage > config.memoryLimit!) {
          this.emit('process:oom_warning', {
            id: config.id,
            usage,
            limit: config.memoryLimit,
          });
          stats.status = ProcessStatus.OOM_KILLED;
          this.kill(config.id!, 'SIGKILL');
        }
      }, 1000);
    }

    // CPU monitoring (simplified - real implementation would use OS APIs)
    if (config.cpuLimit) {
      proc.cpuCheckInterval = setInterval(() => {
        const usage = this.getCpuUsage(proc);
        stats.cpuUsage = usage;

        if (usage > config.cpuLimit!) {
          this.emit('process:cpu_throttle', {
            id: config.id,
            usage,
            limit: config.cpuLimit,
          });
          // In real implementation, apply CPU throttling
        }
      }, 1000);
    }
  }

  private getMemoryUsage(proc: InternalProcess): number {
    // In a real implementation, this would use OS-specific APIs
    // For now, return estimated value
    if (proc.process?.pid) {
      try {
        // This is a placeholder - real implementation would read /proc/[pid]/status or similar
        return Math.floor(Math.random() * 100); // Placeholder
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private getCpuUsage(proc: InternalProcess): number {
    // Placeholder - real implementation would track CPU time deltas
    return Math.floor(Math.random() * 50); // Placeholder
  }

  private async applySandbox(proc: InternalProcess, sandbox: SandboxConfig): Promise<void> {
    // Apply sandbox restrictions
    // Real implementation would use:
    // - Linux: namespaces, cgroups, seccomp, AppArmor/SELinux
    // - macOS: sandbox-exec, seatbelt
    // - Windows: Job Objects, Windows Sandbox
    
    this.emit('process:sandbox_applied', {
      id: proc.config.id,
      sandbox,
    });
  }

  private async killProcess(proc: InternalProcess, signal: NodeJS.Signals): Promise<boolean> {
    if (!proc.process || proc.process.killed) {
      return true;
    }

    try {
      proc.process.kill(signal);
      return true;
    } catch (error) {
      return false;
    }
  }

  private setupGlobalMonitoring(): void {
    // Global resource monitoring
    setInterval(() => {
      this.checkGlobalResources();
    }, 5000);
  }

  private checkGlobalResources(): void {
    const { totalMemoryLimit, totalCpuLimit } = this.globalLimits;
    
    if (totalMemoryLimit) {
      const totalMemory = Array.from(this.processes.values())
        .reduce((sum, p) => sum + p.stats.memoryUsage, 0);
      
      if (totalMemory > totalMemoryLimit * 0.9) {
        this.emit('global:memory_warning', {
          usage: totalMemory,
          limit: totalMemoryLimit,
        });
      }
    }

    // Clean up stopped processes after some time
    for (const [id, proc] of this.processes) {
      if (proc.stats.status === ProcessStatus.STOPPED || 
          proc.stats.status === ProcessStatus.CRASHED) {
        // Keep for a bit for inspection, then remove
        if (proc.stats.endTime) {
          const age = Date.now() - proc.stats.endTime.getTime();
          if (age > 60000) { // 1 minute
            this.processes.delete(id);
          }
        }
      }
    }
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let globalProcessManager: ProcessManager | null = null;

export function getProcessManager(globalLimits?: {
  maxProcesses?: number;
  totalMemoryLimit?: number;
  totalCpuLimit?: number;
}): ProcessManager {
  if (!globalProcessManager) {
    globalProcessManager = new ProcessManager(globalLimits);
  }
  return globalProcessManager;
}

export function createProcessManager(globalLimits?: {
  maxProcesses?: number;
  totalMemoryLimit?: number;
  totalCpuLimit?: number;
}): ProcessManager {
  return new ProcessManager(globalLimits);
}

// ============================================================================
// Exports
// ============================================================================

export default ProcessManager;
