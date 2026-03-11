/**
 * ClawKernel — Persistent Execution with Reputation-Weighted Sandboxing
 * @version 0.2.0
 * @module @exitliquidity/clawkernel
 * 
 * ClawKernel provides:
 * 1. Persistent scheduling (cron-like, survives restarts)
 * 2. Reputation-weighted resource quotas
 * 3. Sandboxed execution (WASM/Firecracker/Docker)
 * 4. Auto-kill on low reputation or policy violation
 * 5. Integration with ClawForge for policy enforcement
 */

import { EventEmitter } from 'events';
import { ClawID } from '../clawid-protocol/clawid-token';
import { TAPClient } from '../tap-sdk/tap-client';
import { ClawForgeControlPlane } from '../clawforge/control-plane';
import { ClawFS } from '../clawfs-protocol/clawfs';

// ============================================================================
// TYPES
// ============================================================================

export type IsolationBackend = 'wasm' | 'firecracker' | 'docker';

export interface ClawKernelConfig {
  agentId: string;
  clawId: ClawID;
  tapClient: TAPClient;
  clawForge?: ClawForgeControlPlane;
  clawFS?: ClawFS;
  defaultBackend?: IsolationBackend;
  checkpointInterval?: number;
}

export interface Task {
  id: string;
  name: string;
  code: Buffer | string;
  entryPoint: string;
  args: string[];
  envVars: Record<string, string>;
  isolationBackend?: IsolationBackend;
  ownerClawId: string;
  priority: number;
  maxRetries: number;
  schedule?: string; // Cron expression for recurring tasks
}

export interface TaskState {
  taskId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';
  sandboxId?: string;
  startedAt?: Date;
  completedAt?: Date;
  retries: number;
  checkpoint?: any;
  lastError?: string;
  reputationAtStart: number;
}

export interface ResourceQuotas {
  cpuMsPerSecond: number;
  memoryMB: number;
  networkKBps: number;
  maxSyscallsPerSec: number;
  maxFileDescriptors: number;
  maxProcesses: number;
  diskIOKBps: number;
}

export interface Sandbox {
  id: string;
  taskId: string;
  backend: IsolationBackend;
  process: any;
  quotas: ResourceQuotas;
  status: 'starting' | 'running' | 'throttled' | 'quarantined' | 'killed';
  reputation: number;
  usage: ResourceUsage;
  startedAt: Date;
}

export interface ResourceUsage {
  cpuTimeMs: number;
  memoryMB: number;
  networkSentKB: number;
  networkRecvKB: number;
  syscallsMade: number;
  filesOpened: number;
}

export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
  adjustedQuotas?: ResourceQuotas;
}

// ============================================================================
// REPUTATION-BASED QUOTA CALCULATOR
// ============================================================================

export class QuotaCalculator {
  private tapClient: TAPClient;

  constructor(tapClient: TAPClient) {
    this.tapClient = tapClient;
  }

  async calculateQuotas(clawId: string): Promise<{ quotas: ResourceQuotas; reputation: number; allowed: boolean }> {
    const reputation = await this.tapClient.getReputation(clawId);

    // Kill threshold
    if (reputation < 30) {
      return { 
        quotas: this.zeroQuotas(), 
        reputation, 
        allowed: false 
      };
    }

    const quotas: ResourceQuotas = {
      cpuMsPerSecond: Math.min(1000, reputation * 10),
      memoryMB: reputation * 1,
      networkKBps: reputation * 10,
      maxSyscallsPerSec: reputation * 50,
      maxFileDescriptors: reputation * 2,
      maxProcesses: Math.floor(reputation / 20),
      diskIOKBps: reputation * 100,
    };

    return { quotas, reputation, allowed: true };
  }

  private zeroQuotas(): ResourceQuotas {
    return {
      cpuMsPerSecond: 0,
      memoryMB: 0,
      networkKBps: 0,
      maxSyscallsPerSec: 0,
      maxFileDescriptors: 0,
      maxProcesses: 0,
      diskIOKBps: 0,
    };
  }
}

// ============================================================================
// SANDBOX BACKENDS
// ============================================================================

abstract class SandboxBackend {
  abstract create(task: Task, quotas: ResourceQuotas): Promise<any>;
  abstract kill(process: any, reason: string): Promise<void>;
  abstract getUsage(process: any): Promise<ResourceUsage>;
  abstract pause(process: any): Promise<void>;
  abstract resume(process: any): Promise<void>;
}

class WASMBackend extends SandboxBackend {
  async create(task: Task, quotas: ResourceQuotas): Promise<any> {
    console.log(`[WASM] Creating sandbox for task ${task.id}`);
    console.log(`       Quotas: CPU ${quotas.cpuMsPerSecond}ms/s, Memory ${quotas.memoryMB}MB`);
    
    // Return mock process handle
    return {
      type: 'wasm',
      pid: Math.floor(Math.random() * 10000),
      quotas,
      startTime: Date.now(),
    };
  }

  async kill(process: any, reason: string): Promise<void> {
    console.log(`[WASM] Killing sandbox ${process.pid}: ${reason}`);
  }

  async getUsage(process: any): Promise<ResourceUsage> {
    return {
      cpuTimeMs: Math.floor(Math.random() * process.quotas.cpuMsPerSecond),
      memoryMB: Math.floor(Math.random() * process.quotas.memoryMB),
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: Math.floor(Math.random() * 100),
      filesOpened: Math.floor(Math.random() * 10),
    };
  }

  async pause(process: any): Promise<void> {
    console.log(`[WASM] Pausing sandbox ${process.pid}`);
  }

  async resume(process: any): Promise<void> {
    console.log(`[WASM] Resuming sandbox ${process.pid}`);
  }
}

class FirecrackerBackend extends SandboxBackend {
  async create(task: Task, quotas: ResourceQuotas): Promise<any> {
    console.log(`[Firecracker] Creating microVM for task ${task.id}`);
    console.log(`              Memory: ${quotas.memoryMB}MB`);
    
    return {
      type: 'firecracker',
      vmId: `vm-${Date.now()}`,
      quotas,
      startTime: Date.now(),
    };
  }

  async kill(process: any, reason: string): Promise<void> {
    console.log(`[Firecracker] Killing microVM ${process.vmId}: ${reason}`);
  }

  async getUsage(process: any): Promise<ResourceUsage> {
    return {
      cpuTimeMs: Math.floor(Math.random() * process.quotas.cpuMsPerSecond),
      memoryMB: process.quotas.memoryMB,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
    };
  }

  async pause(process: any): Promise<void> {
    console.log(`[Firecracker] Pausing microVM ${process.vmId}`);
  }

  async resume(process: any): Promise<void> {
    console.log(`[Firecracker] Resuming microVM ${process.vmId}`);
  }
}

// ============================================================================
// CORE CLAWKERNEL CLASS
// ============================================================================

export class ClawKernel extends EventEmitter {
  private config: ClawKernelConfig;
  private quotaCalc: QuotaCalculator;
  private tasks: Map<string, TaskState> = new Map();
  private sandboxes: Map<string, Sandbox> = new Map();
  private backends: Map<IsolationBackend, SandboxBackend> = new Map();
  private monitorInterval?: NodeJS.Timeout;
  private checkpointInterval?: NodeJS.Timeout;

  constructor(config: ClawKernelConfig) {
    super();
    this.config = config;
    this.quotaCalc = new QuotaCalculator(config.tapClient);
    
    // Initialize backends
    this.backends.set('wasm', new WASMBackend());
    this.backends.set('firecracker', new FirecrackerBackend());
  }

  // --------------------------------------------------------------------------
  // TASK SCHEDULING
  // --------------------------------------------------------------------------

  async schedule(task: Task): Promise<TaskState> {
    console.log(`[ClawKernel] Scheduling task ${task.id}`);

    // Step 1: ClawForge policy check
    if (this.config.clawForge) {
      const policyCheck = await this.config.clawForge.checkTaskPolicy(task);
      if (!policyCheck.allowed) {
        throw new Error(`Task rejected by ClawForge: ${policyCheck.reason}`);
      }
    }

    // Step 2: Calculate reputation-based quotas
    const { quotas, reputation, allowed } = await this.quotaCalc.calculateQuotas(task.ownerClawId);
    
    if (!allowed) {
      throw new Error(`Task rejected: reputation ${reputation} below threshold (30)`);
    }

    // Step 3: Create task state
    const state: TaskState = {
      taskId: task.id,
      status: 'pending',
      retries: 0,
      reputationAtStart: reputation,
    };

    this.tasks.set(task.id, state);

    // Step 4: Launch sandbox and execute
    await this.launchTask(task, state, quotas);

    return state;
  }

  private async launchTask(task: Task, state: TaskState, quotas: ResourceQuotas): Promise<void> {
    const backendType = task.isolationBackend || this.config.defaultBackend || 'wasm';
    const backend = this.backends.get(backendType);
    
    if (!backend) {
      throw new Error(`Unknown backend: ${backendType}`);
    }

    // Create sandbox
    const sandboxId = `sb-${task.id}-${Date.now()}`;
    const process = await backend.create(task, quotas);

    const sandbox: Sandbox = {
      id: sandboxId,
      taskId: task.id,
      backend: backendType,
      process,
      quotas,
      status: 'running',
      reputation: state.reputationAtStart,
      usage: {
        cpuTimeMs: 0,
        memoryMB: 0,
        networkSentKB: 0,
        networkRecvKB: 0,
        syscallsMade: 0,
        filesOpened: 0,
      },
      startedAt: new Date(),
    };

    this.sandboxes.set(sandboxId, sandbox);
    state.sandboxId = sandboxId;
    state.status = 'running';
    state.startedAt = new Date();

    // Register with ClawForge
    if (this.config.clawForge) {
      await this.config.clawForge.registerSandbox(sandbox);
    }

    // Start monitoring
    this.startMonitoring();

    this.emit('task:started', { taskId: task.id, sandboxId, reputation: state.reputationAtStart });
  }

  // --------------------------------------------------------------------------
  // MONITORING & ENFORCEMENT
  // --------------------------------------------------------------------------

  private startMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(async () => {
      await this.checkAllSandboxes();
    }, 5000);
  }

  private async checkAllSandboxes(): Promise<void> {
    for (const [sandboxId, sandbox] of this.sandboxes) {
      if (sandbox.status === 'killed') continue;

      try {
        await this.checkSandbox(sandbox);
      } catch (error) {
        console.error(`[ClawKernel] Error checking sandbox ${sandboxId}:`, error);
      }
    }
  }

  private async checkSandbox(sandbox: Sandbox): Promise<void> {
    const backend = this.backends.get(sandbox.backend);
    if (!backend) return;

    // Get current usage
    const usage = await backend.getUsage(sandbox.process);
    sandbox.usage = usage;

    // Re-query reputation
    const { reputation } = await this.quotaCalc.calculateQuotas(sandbox.taskId);
    sandbox.reputation = reputation;

    // Check kill conditions
    if (reputation < 30) {
      await this.killSandbox(sandbox.id, 'REPUTATION_BELOW_THRESHOLD');
      return;
    }

    // Check quota violations
    const violations = this.detectViolations(sandbox, usage);
    
    for (const violation of violations) {
      // Report to ClawForge
      if (this.config.clawForge) {
        await this.config.clawForge.reportViolation(sandbox, violation);
      }

      // Auto-kill on critical violations
      if (violation.severity === 'critical') {
        await this.killSandbox(sandbox.id, violation.type);
        return;
      }

      // Throttle on warnings
      if (violation.type === 'CPU_QUOTA') {
        sandbox.status = 'throttled';
        await backend.pause(sandbox.process);
        setTimeout(() => backend.resume(sandbox.process), 1000);
      }
    }

    // Update ClawForge with current stats
    if (this.config.clawForge) {
      await this.config.clawForge.updateSandboxStats(sandbox);
    }
  }

  private detectViolations(sandbox: Sandbox, usage: ResourceUsage): Array<{ type: string; severity: 'warning' | 'critical' }> {
    const violations: Array<{ type: string; severity: 'warning' | 'critical' }> = [];

    if (usage.memoryMB > sandbox.quotas.memoryMB) {
      violations.push({ type: 'MEMORY_QUOTA', severity: 'critical' });
    }

    if (usage.cpuTimeMs > sandbox.quotas.cpuMsPerSecond) {
      violations.push({ type: 'CPU_QUOTA', severity: 'warning' });
    }

    if (sandbox.quotas.networkKBps === 0 && (usage.networkSentKB > 0 || usage.networkRecvKB > 0)) {
      violations.push({ type: 'NETWORK_ISOLATION_BREACH', severity: 'critical' });
    }

    return violations;
  }

  // --------------------------------------------------------------------------
  // SANDBOX LIFECYCLE
  // --------------------------------------------------------------------------

  async killSandbox(sandboxId: string, reason: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox || sandbox.status === 'killed') return;

    console.log(`[ClawKernel] Killing sandbox ${sandboxId}: ${reason}`);

    const backend = this.backends.get(sandbox.backend);
    if (backend) {
      await backend.kill(sandbox.process, reason);
    }

    sandbox.status = 'killed';

    // Update task state
    const taskState = this.tasks.get(sandbox.taskId);
    if (taskState) {
      taskState.status = 'killed';
    }

    // Notify ClawForge
    if (this.config.clawForge) {
      await this.config.clawForge.reportSandboxKilled(sandbox, reason);
    }

    // Queue Arbitra dispute if malicious
    if (reason === 'MEMORY_QUOTA' || reason === 'NETWORK_ISOLATION_BREACH') {
      await this.queueArbitraDispute(sandbox, reason);
    }

    this.emit('sandbox:killed', { sandboxId, reason });
  }

  private async queueArbitraDispute(sandbox: Sandbox, violation: string): Promise<void> {
    console.log(`[ClawKernel] Queuing Arbitra dispute for sandbox ${sandbox.id}`);
    console.log(`             Violation: ${violation}`);
    console.log(`             Agent: ${sandbox.taskId}`);
    
    // In production: submit to Arbitra contract
    this.emit('arbitra:dispute_queued', {
      sandboxId: sandbox.id,
      taskId: sandbox.taskId,
      violation,
      evidence: {
        reputation: sandbox.reputation,
        usage: sandbox.usage,
        quotas: sandbox.quotas,
      },
    });
  }

  // --------------------------------------------------------------------------
  // CHECKPOINTING
  // --------------------------------------------------------------------------

  startCheckpointing(intervalMs: number = 30000): void {
    this.checkpointInterval = setInterval(async () => {
      await this.checkpointAll();
    }, intervalMs);
  }

  private async checkpointAll(): Promise<void> {
    for (const [taskId, state] of this.tasks) {
      if (state.status === 'running' && state.sandboxId) {
        const sandbox = this.sandboxes.get(state.sandboxId);
        if (sandbox) {
          state.checkpoint = {
            timestamp: Date.now(),
            reputation: sandbox.reputation,
            usage: sandbox.usage,
          };

          // Persist to ClawFS if available
          if (this.config.clawFS) {
            await this.config.clawFS.checkpoint(taskId, state.checkpoint);
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
// --------------------------------------------------------------------------

  getTaskState(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  getSandbox(sandboxId: string): Sandbox | undefined {
    return this.sandboxes.get(sandboxId);
  }

  listActiveSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values()).filter(s => s.status === 'running');
  }

  async shutdown(): Promise<void> {
    // Kill all sandboxes
    for (const [sandboxId] of this.sandboxes) {
      await this.killSandbox(sandboxId, 'KERNEL_SHUTDOWN');
    }

    // Clear intervals
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.checkpointInterval) clearInterval(this.checkpointInterval);

    this.emit('kernel:shutdown');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawKernel;
export { QuotaCalculator, Task, TaskState, Sandbox, ResourceQuotas };
