/**
 * ClawKernel Sandbox Integration
 * 
 * Bridges ProcessManager with ClawSandbox to provide reputation-weighted
 * hardware isolation for agent processes.
 * 
 * When you call kernel.spawn(), it creates a Firecracker microVM (or WASM/Docker)
 * with resources allocated based on the agent's TAP reputation score.
 */

import { EventEmitter } from 'events';
import { ProcessManager, ProcessConfig, ProcessStatus, ProcessHandle } from './process';
import { SecurityMode, ResourceQuotas, IsolationBackend } from '../sandbox';

// ============================================================================
// Types
// ============================================================================

export interface KernelSandboxConfig {
  /** Agent ID for TAP reputation lookup */
  agentId: string;
  /** Current TAP reputation score (0-10000) */
  tapScore?: number;
  /** Isolation backend to use */
  backend?: IsolationBackend;
  /** Code to execute (WASM binary path, Docker image, or Firecracker rootfs) */
  code: string;
  /** Entry point command */
  entryPoint?: string;
  /** Environment variables */
  envVars?: Record<string, string>;
  /** Command line arguments */
  args?: string[];
  /** Auto-kill if reputation drops below threshold */
  minReputation?: number;
}

export interface SandboxProcess extends ProcessHandle {
  /** Sandbox-specific metadata */
  sandboxId: string;
  backend: IsolationBackend;
  quotas: ResourceQuotas;
  securityMode: SecurityMode;
  /** Current reputation (monitored for changes) */
  currentReputation: number;
  /** Kill threshold for auto-termination */
  minReputation: number;
}

// ============================================================================
// Reputation-to-Resources Calculator
// ============================================================================

export function calculateQuotasFromReputation(
  reputation: number,
  hasActiveDispute: boolean = false
): { quotas: ResourceQuotas; mode: SecurityMode } {
  // Determine security mode
  let mode: SecurityMode;
  if (reputation < 30) {
    mode = 'kill';
  } else if (hasActiveDispute) {
    mode = 'quarantine';
  } else if (reputation < 50) {
    mode = 'restricted';
  } else if (reputation < 80) {
    mode = 'standard';
  } else {
    mode = 'trusted';
  }

  // Calculate quotas from reputation (0-10000 scale)
  const normalizedRep = reputation / 100; // Convert to 0-100 scale
  
  const quotas: ResourceQuotas = {
    cpuMsPerSecond: Math.min(1000, normalizedRep * 10),
    memoryMB: normalizedRep * 10, // 10MB per reputation point = 1GB at rep 100
    networkKBps: normalizedRep * 100,
    maxSyscallsPerSec: normalizedRep * 100,
    maxFileDescriptors: normalizedRep * 5,
    maxProcesses: Math.floor(normalizedRep / 5),
    diskIOKBps: normalizedRep * 1000,
  };

  // Apply dispute penalties
  if (hasActiveDispute) {
    quotas.cpuMsPerSecond = Math.floor(quotas.cpuMsPerSecond * 0.1);
    quotas.networkKBps = 0; // Full network isolation
    quotas.maxSyscallsPerSec = Math.floor(quotas.maxSyscallsPerSec * 0.2);
  }

  return { quotas, mode };
}

// ============================================================================
// Sandbox Process Manager
// ============================================================================

interface InternalSandboxProcess extends SandboxProcess {
  processManagerId: string;
  reputationCheckInterval?: NodeJS.Timeout;
}

export class SandboxProcessManager extends EventEmitter {
  private processes = new Map<string, InternalSandboxProcess>();
  private processManager: ProcessManager;
  private readonly defaultMinReputation = 30;
  private readonly reputationCheckIntervalMs = 5000;

  constructor(globalLimits?: {
    maxProcesses?: number;
    totalMemoryLimit?: number;
    totalCpuLimit?: number;
  }) {
    super();
    this.processManager = new ProcessManager(globalLimits);
  }

  /**
   * Spawn a new sandboxed process
   * 
   * This creates an isolated execution environment (Firecracker/WASM/Docker)
   * with resources allocated based on the agent's TAP reputation.
   */
  async spawn(config: KernelSandboxConfig): Promise<SandboxProcess> {
    const id = `sb-${config.agentId}-${Date.now()}`;
    
    // Get reputation (default to 50 if not provided - mid-tier)
    const reputation = config.tapScore ?? 5000;
    const minReputation = config.minReputation ?? this.defaultMinReputation;

    // Check kill threshold
    if (reputation < minReputation) {
      throw new Error(
        `Agent ${config.agentId} reputation (${reputation}) below minimum threshold (${minReputation})`
      );
    }

    // Calculate quotas from reputation
    const { quotas, mode } = calculateQuotasFromReputation(reputation);

    // Choose backend (default to docker for MVP, firecracker for production)
    const backend = config.backend ?? 'docker';

    this.emit('sandbox:spawning', { id, agentId: config.agentId, backend, quotas, mode });

    // Create the underlying process based on backend
    const processConfig: ProcessConfig = {
      id,
      name: `claw-${config.agentId}`,
      command: this.buildCommand(backend, config),
      args: config.args,
      env: {
        ...config.envVars,
        CLAW_AGENT_ID: config.agentId,
        CLAW_SANDBOX_ID: id,
        CLAW_BACKEND: backend,
        CLAW_REPUTATION: String(reputation),
        CLAW_MEMORY_LIMIT_MB: String(quotas.memoryMB),
        CLAW_CPU_LIMIT: String(quotas.cpuMsPerSecond),
      },
      memoryLimit: quotas.memoryMB,
      cpuLimit: quotas.cpuMsPerSecond / 10, // Convert to percentage
      sandbox: {
        noNetwork: quotas.networkKBps === 0,
        dropPrivileges: mode !== 'trusted',
        isolateResources: true,
      },
      restartPolicy: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        onlyOnFailure: true,
      },
    };

    // Spawn through ProcessManager
    const handle = await this.processManager.spawn(processConfig);

    // Create sandbox wrapper
    const sandboxProcess: InternalSandboxProcess = {
      ...handle,
      sandboxId: id,
      backend,
      quotas,
      securityMode: mode,
      currentReputation: reputation,
      minReputation,
      processManagerId: handle.id,
    };

    this.processes.set(id, sandboxProcess);

    // Start reputation monitoring
    this.startReputationMonitoring(sandboxProcess);

    this.emit('sandbox:spawned', {
      id,
      agentId: config.agentId,
      backend,
      quotas,
      mode,
      pid: handle.id,
    });

    return sandboxProcess;
  }

  /**
   * Kill a sandboxed process
   */
  async kill(sandboxId: string, reason: string): Promise<boolean> {
    const process = this.processes.get(sandboxId);
    if (!process) {
      return false;
    }

    // Stop reputation monitoring
    if (process.reputationCheckInterval) {
      clearInterval(process.reputationCheckInterval);
    }

    // Kill through ProcessManager
    const result = await this.processManager.kill(process.processManagerId);

    this.processes.delete(sandboxId);
    this.emit('sandbox:killed', { sandboxId, reason, agentId: process.id });

    return result;
  }

  /**
   * Get sandbox process status
   */
  getProcess(sandboxId: string): SandboxProcess | undefined {
    return this.processes.get(sandboxId);
  }

  /**
   * List all sandbox processes
   */
  listProcesses(): SandboxProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Shutdown all sandbox processes
   */
  async shutdown(): Promise<void> {
    const killPromises = Array.from(this.processes.keys()).map(id =>
      this.kill(id, 'SHUTDOWN')
    );
    await Promise.all(killPromises);
    await this.processManager.shutdown();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private buildCommand(backend: IsolationBackend, config: KernelSandboxConfig): string {
    switch (backend) {
      case 'firecracker':
        // Firecracker microVM
        return `firecracker --api-sock /tmp/claw-${config.agentId}.sock`;
      
      case 'wasm':
        // WASM runtime (wasmer or wasmtime)
        return `wasmer run ${config.code}`;
      
      case 'docker':
      default:
        // Docker container
        return `docker run --rm \
          --name claw-${config.agentId} \
          --memory=${config.tapScore ?? 500}m \
          --cpus=${((config.tapScore ?? 5000) / 10000) * 2} \
          ${config.entryPoint || '/bin/sh'}`;
    }
  }

  private startReputationMonitoring(process: InternalSandboxProcess): void {
    process.reputationCheckInterval = setInterval(async () => {
      try {
        // In production, this would query TAP for live reputation
        // For now, we use the initial reputation
        const currentReputation = process.currentReputation;

        // Check kill threshold
        if (currentReputation < process.minReputation) {
          await this.kill(process.sandboxId, 'REPUTATION_BELOW_THRESHOLD');
          return;
        }

        // Check for quarantine mode
        const { mode } = calculateQuotasFromReputation(currentReputation);
        if (mode === 'quarantine' && process.securityMode !== 'quarantine') {
          this.emit('sandbox:quarantined', {
            sandboxId: process.sandboxId,
            agentId: process.id,
            reason: 'ACTIVE_DISPUTE',
          });
          // Update process mode
          process.securityMode = mode;
        }

        this.emit('sandbox:status', {
          sandboxId: process.sandboxId,
          agentId: process.id,
          reputation: currentReputation,
          mode: process.securityMode,
        });
      } catch (error) {
        this.emit('sandbox:error', {
          sandboxId: process.sandboxId,
          error,
        });
      }
    }, this.reputationCheckIntervalMs);
  }
}

// ============================================================================
// Exports
// ============================================================================

export { ProcessStatus, ProcessConfig } from './process';
export default SandboxProcessManager;
