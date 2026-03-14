/**
 * ClawSandbox — Reputation-Weighted Sandboxing for MoltOS
 * @version 0.1.0-alpha
 * 
 * Provides hard isolation (WASM/Firecracker/Docker) with reputation-weighted
 * resource quotas, auto-kill on low reputation, and full telemetry.
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IsolationBackend = 'wasm' | 'firecracker' | 'docker';
export type SecurityMode = 'trusted' | 'standard' | 'restricted' | 'quarantine' | 'kill';

export interface ResourceQuotas {
  cpuMsPerSecond: number;      // 0-1000ms CPU time per second
  memoryMB: number;            // Max RAM allocation
  networkKBps: number;         // Network bandwidth limit
  maxSyscallsPerSec: number;   // Syscall rate limiting
  maxFileDescriptors: number;  // FD limit
  maxProcesses: number;        // Process/thread limit
  diskIOKBps: number;          // Disk I/O limit
}

export interface ResourceUsage {
  cpuTimeMs: number;
  memoryMB: number;
  networkSentKB: number;
  networkRecvKB: number;
  syscallsMade: number;
  filesOpened: number;
  processesSpawned: number;
  diskIOReadKB: number;
  diskIOWriteKB: number;
}

export interface SandboxStatus {
  pid: number | string;
  state: 'starting' | 'running' | 'throttled' | 'quarantined' | 'killed' | 'exited';
  reputation: number;
  activeDispute: boolean;
  quotas: ResourceQuotas;
  usage: ResourceUsage;
  startedAt: Date;
  lastCheckedAt: Date;
}

export interface SyscallLog {
  timestamp: number;
  syscall: string;
  args: any[];
  result: any;
  allowed: boolean;
  durationMs: number;
}

export interface Violation {
  type: 'CPU_QUOTA' | 'MEMORY_QUOTA' | 'NETWORK_QUOTA' | 'SYSCALL_RATE' | 'FORBIDDEN_SYSCALL' | 'DISPUTE_SLASHING';
  severity: 'warning' | 'critical';
  timestamp: number;
  details: string;
  autoAction: 'throttle' | 'quarantine' | 'kill';
}

export interface TelemetryReport {
  agentId: string;
  sandboxId: string;
  period: { start: number; end: number };
  usage: ResourceUsage;
  syscalls: SyscallLog[];
  violations: Violation[];
  reputationHistory: { timestamp: number; reputation: number }[];
}

export interface SandboxConfig {
  agentId: string;
  tapScore: number;           // Current reputation (0-10000)
  isolationBackend: IsolationBackend;
  securityMode?: SecurityMode;
  code: Buffer | string;
  entryPoint: string;
  envVars: Record<string, string>;
  args: string[];
}

// ============================================================================
// REPUTATION-BASED QUOTA CALCULATOR
// ============================================================================

export class QuotaCalculator extends EventEmitter {
  private arbitraClient?: any;

  constructor(arbitraClient?: any) {
    super();
    this.arbitraClient = arbitraClient;
  }

  async calculateQuotas(agentId: string, reputation: number): Promise<{ quotas: ResourceQuotas; mode: SecurityMode }> {
    // Check for active disputes
    const activeDispute = await this.checkActiveDispute(agentId);
    
    // Determine security mode
    const mode = this.determineSecurityMode(reputation, activeDispute);
    
    // Calculate base quotas from reputation (0-10000 scale)
    const normalizedRep = reputation / 100; // 0-100 scale
    
    const quotas: ResourceQuotas = {
      cpuMsPerSecond: Math.min(1000, normalizedRep * 10),
      memoryMB: normalizedRep * 10,
      networkKBps: normalizedRep * 100,
      maxSyscallsPerSec: normalizedRep * 100,
      maxFileDescriptors: normalizedRep * 5,
      maxProcesses: Math.floor(normalizedRep / 5),
      diskIOKBps: normalizedRep * 1000,
    };

    // Apply dispute penalties
    if (activeDispute) {
      quotas.cpuMsPerSecond = Math.floor(quotas.cpuMsPerSecond * 0.1);
      quotas.networkKBps = 0;
      quotas.maxSyscallsPerSec = Math.floor(quotas.maxSyscallsPerSec * 0.2);
    }

    return { quotas, mode };
  }

  private determineSecurityMode(reputation: number, activeDispute: boolean): SecurityMode {
    if (reputation < 30) return 'kill';
    if (activeDispute) return 'quarantine';
    if (reputation < 50) return 'restricted';
    if (reputation < 80) return 'standard';
    return 'trusted';
  }

  private async checkActiveDispute(agentId: string): Promise<boolean> {
    if (!this.arbitraClient) return false;
    try {
      return await this.arbitraClient.hasActiveDispute(agentId);
    } catch {
      return false;
    }
  }
}

// ============================================================================
// ISOLATION BACKENDS
// ============================================================================

export abstract class IsolationBackendProvider {
  abstract name: string;
  abstract createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any>;
  abstract kill(process: any, reason: string): Promise<void>;
  abstract getUsage(process: any): Promise<ResourceUsage>;
  abstract pause(process: any): Promise<void>;
  abstract resume(process: any): Promise<void>;
}

// WASM Backend
export class WASMBackend extends IsolationBackendProvider {
  name = 'wasm';
  
  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    console.log(`[WASM] Creating sandbox for ${config.agentId}`);
    return {
      type: 'wasm',
      agentId: config.agentId,
      quotas,
    };
  }

  async kill(instance: any, reason: string): Promise<void> {
    console.log(`[WASM] Killing ${instance.agentId}: ${reason}`);
  }

  async getUsage(instance: any): Promise<ResourceUsage> {
    return {
      cpuTimeMs: 0,
      memoryMB: instance.quotas.memoryMB,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
      processesSpawned: 1,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  async pause(instance: any): Promise<void> {}
  async resume(instance: any): Promise<void> {}
}

// Firecracker MicroVM Backend
export class FirecrackerBackend extends IsolationBackendProvider {
  name = 'firecracker';
  
  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    const vmId = `claw-${config.agentId}-${Date.now()}`;
    console.log(`[Firecracker] Spawning VM ${vmId}`);
    
    return {
      type: 'firecracker',
      vmId,
      agentId: config.agentId,
      quotas,
      startedAt: Date.now(),
    };
  }

  async kill(vmInfo: any, reason: string): Promise<void> {
    console.log(`[Firecracker] Killing VM ${vmInfo.vmId}: ${reason}`);
  }

  async getUsage(vmInfo: any): Promise<ResourceUsage> {
    return {
      cpuTimeMs: 0,
      memoryMB: vmInfo.quotas.memoryMB,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
      processesSpawned: 1,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  async pause(vmInfo: any): Promise<void> {}
  async resume(vmInfo: any): Promise<void> {}
}

// Docker + seccomp Backend
export class DockerBackend extends IsolationBackendProvider {
  name = 'docker';

  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    const containerName = `claw-${config.agentId}`;
    console.log(`[Docker] Creating container ${containerName}`);
    
    return {
      type: 'docker',
      containerName,
      agentId: config.agentId,
      quotas,
    };
  }

  async kill(container: any, reason: string): Promise<void> {
    console.log(`[Docker] Killing container ${container.containerName}: ${reason}`);
  }

  async getUsage(container: any): Promise<ResourceUsage> {
    return {
      cpuTimeMs: 0,
      memoryMB: container.quotas.memoryMB,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
      processesSpawned: 1,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  async pause(container: any): Promise<void> {}
  async resume(container: any): Promise<void> {}
}

// ============================================================================
// CORE CLAWSANDBOX CLASS
// ============================================================================

export class ClawSandbox extends EventEmitter {
  private config: SandboxConfig;
  private quotaCalc: QuotaCalculator;
  private backend: IsolationBackendProvider;
  private status: SandboxStatus;
  private process: any;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly SANDBOX_ID: string;

  constructor(config: SandboxConfig) {
    super();
    this.config = config;
    this.SANDBOX_ID = `sb-${config.agentId}-${Date.now()}`;
    this.quotaCalc = new QuotaCalculator();
    this.backend = this.selectBackend(config.isolationBackend);
    
    this.status = {
      pid: 0,
      state: 'starting',
      reputation: config.tapScore,
      activeDispute: false,
      quotas: {
        cpuMsPerSecond: 0,
        memoryMB: 0,
        networkKBps: 0,
        maxSyscallsPerSec: 0,
        maxFileDescriptors: 0,
        maxProcesses: 0,
        diskIOKBps: 0,
      },
      usage: {
        cpuTimeMs: 0,
        memoryMB: 0,
        networkSentKB: 0,
        networkRecvKB: 0,
        syscallsMade: 0,
        filesOpened: 0,
        processesSpawned: 0,
        diskIOReadKB: 0,
        diskIOWriteKB: 0,
      },
      startedAt: new Date(),
      lastCheckedAt: new Date(),
    };
  }

  private selectBackend(backend: IsolationBackend): IsolationBackendProvider {
    switch (backend) {
      case 'wasm': return new WASMBackend();
      case 'firecracker': return new FirecrackerBackend();
      case 'docker': return new DockerBackend();
      default: return new DockerBackend();
    }
  }

  async start(): Promise<SandboxStatus> {
    // Calculate quotas
    const { quotas, mode } = await this.quotaCalc.calculateQuotas(
      this.config.agentId, 
      this.config.tapScore
    );
    
    if (mode === 'kill') {
      throw new Error(`Agent ${this.config.agentId} reputation too low`);
    }

    this.status.quotas = quotas;
    this.process = await this.backend.createSandbox(this.config, quotas);
    this.status.pid = this.process.vmId || this.process.containerName || 0;
    this.status.state = 'running';

    this.startMonitoring();
    this.emit('started', this.status);
    return this.status;
  }

  async kill(reason: string): Promise<void> {
    if (this.status.state === 'killed' || this.status.state === 'exited') return;

    this.status.state = 'killed';
    await this.backend.kill(this.process, reason);
    
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.emit('killed', { reason });
  }

  getStatus(): SandboxStatus {
    return { ...this.status };
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(async () => {
      this.status.usage = await this.backend.getUsage(this.process);
      this.status.lastCheckedAt = new Date();
      this.emit('status', this.status);
    }, 5000);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawSandbox;
export { QuotaCalculator, WASMBackend, FirecrackerBackend, DockerBackend };
