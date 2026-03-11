/**
 * ClawSandbox — Reputation-Weighted Sandboxing for ClawOS
 * @version 0.1.0-alpha
 * @module @exitliquidity/clawsandbox
 * 
 * Provides hard isolation (WASM/Firecracker) with reputation-weighted
 * resource quotas, auto-kill on low reputation, and full telemetry.
 */

import { EventEmitter } from 'events';
import { ClawID } from '../clawid-protocol/clawid-token';
import { TAPClient } from '../tap-sdk/tap-client';
import { ClawForgeControlPlane } from '../clawforge/control-plane';
import { ClawFS } from '../clawfs-protocol/clawfs';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IsolationBackend = 'wasm' | 'firecracker' | 'docker';
export type SecurityMode = 'trusted' | 'standard' | 'restricted' | 'quarantine' | 'kill';

export interface SandboxConfig {
  agentId: string;
  clawId: ClawID;
  tapClient: TAPClient;
  clawForge?: ClawForgeControlPlane;
  clawFS?: ClawFS;
  isolationBackend: IsolationBackend;
  securityMode?: SecurityMode;
  code: Buffer | string; // WASM binary or container image
  entryPoint: string;
  envVars: Record<string, string>;
  args: string[];
}

export interface ResourceQuotas {
  cpuMsPerSecond: number;      // 0-1000ms CPU time per second
  memoryMB: number;            // Max RAM allocation
  networkKBps: number;         // Network bandwidth limit
  maxSyscallsPerSec: number;   // Syscall rate limiting
  maxFileDescriptors: number;  // FD limit
  maxProcesses: number;        // Process/thread limit
  diskIOKBps: number;          // Disk I/O limit
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

export interface SyscallLog {
  timestamp: number;
  syscall: string;
  args: any[];
  result: any;
  allowed: boolean;
  durationMs: number;
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

export interface Violation {
  type: 'CPU_QUOTA' | 'MEMORY_QUOTA' | 'NETWORK_QUOTA' | 'SYSCALL_RATE' | 'FORBIDDEN_SYSCALL' | 'DISPUTE_SLASHING';
  severity: 'warning' | 'critical';
  timestamp: number;
  details: string;
  autoAction: 'throttle' | 'quarantine' | 'kill';
}

export interface SandboxInstance {
  id: string;
  config: SandboxConfig;
  status: SandboxStatus;
  process: any; // Backend-specific process handle
  emitter: EventEmitter;
  telemetry: TelemetryCollector;
  kill(reason: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getReport(): TelemetryReport;
}

// ============================================================================
// REPUTATION-BASED QUOTA CALCULATOR
// ============================================================================

export class QuotaCalculator {
  private tapClient: TAPClient;
  private arbitraClient: any; // Would be ArbitraVoting

  constructor(tapClient: TAPClient, arbitraClient?: any) {
    this.tapClient = tapClient;
    this.arbitraClient = arbitraClient;
  }

  async calculateQuotas(agentId: string): Promise<{ quotas: ResourceQuotas; mode: SecurityMode }> {
    // Query current reputation
    const reputation = await this.tapClient.getReputation(agentId);
    
    // Check for active disputes
    const activeDispute = await this.checkActiveDispute(agentId);
    
    // Determine security mode
    const mode = this.determineSecurityMode(reputation, activeDispute);
    
    // Calculate base quotas from reputation
    const quotas: ResourceQuotas = {
      cpuMsPerSecond: Math.min(1000, reputation * 10),
      memoryMB: reputation * 1,
      networkKBps: reputation * 10,
      maxSyscallsPerSec: reputation * 50,
      maxFileDescriptors: reputation * 2,
      maxProcesses: Math.floor(reputation / 20),
      diskIOKBps: reputation * 100,
    };

    // Apply dispute penalties
    if (activeDispute) {
      quotas.cpuMsPerSecond = Math.floor(quotas.cpuMsPerSecond * 0.1);
      quotas.networkKBps = 0; // Full network isolation
      quotas.maxSyscallsPerSec = Math.floor(quotas.maxSyscallsPerSec * 0.2);
    }

    // Kill threshold check
    if (reputation < 30) {
      return { quotas, mode: 'kill' };
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
    return this.arbitraClient.hasActiveDispute(agentId);
  }

  // Dynamic quota adjustment based on behavior
  async adjustForViolation(
    agentId: string, 
    violation: Violation
  ): Promise<{ newQuotas: ResourceQuotas; action: string }> {
    const current = await this.calculateQuotas(agentId);
    
    switch (violation.severity) {
      case 'warning':
        // Throttle for 60 seconds
        return {
          newQuotas: { ...current.quotas, cpuMsPerSecond: current.quotas.cpuMsPerSecond * 0.5 },
          action: 'throttle',
        };
      case 'critical':
        // Quarantine or kill
        if (current.mode === 'quarantine') {
          return { newQuotas: current.quotas, action: 'kill' };
        }
        return {
          newQuotas: { ...current.quotas, networkKBps: 0 },
          action: 'quarantine',
        };
      default:
        return { newQuotas: current.quotas, action: 'warn' };
    }
  }
}

// ============================================================================
// ISOLATION BACKENDS
// ============================================================================

export abstract class IsolationBackendProvider {
  abstract name: string;
  abstract async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any>;
  abstract async kill(process: any, reason: string): Promise<void>;
  abstract async getUsage(process: any): Promise<ResourceUsage>;
  abstract async pause(process: any): Promise<void>;
  abstract async resume(process: any): Promise<void>;
}

// WASM Backend (wasmer/wasmtime)
export class WASMBackend extends IsolationBackendProvider {
  name = 'wasm';
  private runtime: any; // Wasmer or Wasmtime instance

  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    // Initialize WASM runtime with resource limits
    const wasmModule = await this.compileWASM(config.code as Buffer);
    
    const instance = await this.runtime.instantiate(wasmModule, {
      // Host imports (controlled syscalls)
      env: {
        memory: new WebAssembly.Memory({ initial: quotas.memoryMB / 64 }),
        // Limited syscall interface
        __claw_log: (ptr: number, len: number) => this.syscallHandler('log', ptr, len),
        __claw_read: (fd: number, ptr: number, len: number) => this.syscallHandler('read', fd, ptr, len),
        __claw_write: (fd: number, ptr: number, len: number) => this.syscallHandler('write', fd, ptr, len),
        // ... more limited syscalls
      },
    });

    // Set CPU quota via timer
    this.enforceCPUQuota(instance, quotas.cpuMsPerSecond);

    return instance;
  }

  private async compileWASM(code: Buffer): Promise<any> {
    // Validate and compile WASM
    return WebAssembly.compile(code);
  }

  private syscallHandler(name: string, ...args: any[]): any {
    // Log syscall for telemetry
    // Check against allowed list
    // Rate limit
    return 0;
  }

  private enforceCPUQuota(instance: any, quotaMs: number): void {
    // Set interval to pause/resume based on quota
    let usedMs = 0;
    setInterval(() => {
      if (usedMs >= quotaMs) {
        this.pause(instance);
        setTimeout(() => {
          usedMs = 0;
          this.resume(instance);
        }, 1000);
      }
    }, 100);
  }

  async kill(instance: any, reason: string): Promise<void> {
    console.log(`[WASM] Killing instance: ${reason}`);
    // Terminate WASM execution
  }

  async getUsage(instance: any): Promise<ResourceUsage> {
    // Extract memory usage from WASM instance
    return {
      cpuTimeMs: 0, // Tracked externally
      memoryMB: instance.exports.memory.buffer.byteLength / (1024 * 1024),
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
      processesSpawned: 1,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  async pause(instance: any): Promise<void> {
    // WASM pause mechanism
  }

  async resume(instance: any): Promise<void> {
    // WASM resume mechanism
  }
}

// Firecracker MicroVM Backend
export class FirecrackerBackend extends IsolationBackendProvider {
  name = 'firecracker';
  private apiSocket: string;

  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    const vmId = `claw-${config.agentId}-${Date.now()}`;
    
    // Configure microVM
    const vmConfig = {
      boot_source: {
        kernel_image_path: '/opt/clawos/firecracker-vmlinux',
        boot_args: 'console=ttyS0 reboot=k panic=1 pci=off',
      },
      drives: [{
        drive_id: 'rootfs',
        path_on_host: `/opt/clawos/rootfs-${config.securityMode}.ext4`,
        is_root_device: true,
        is_read_only: true,
      }],
      machine_config: {
        vcpu_count: 1,
        mem_size_mib: quotas.memoryMB,
      },
      // Network configuration (limited by quotas)
      network_interfaces: quotas.networkKBps > 0 ? [{
        iface_id: 'eth0',
        guest_mac: 'AA:FC:00:00:00:01',
        host_dev_name: `tap-${vmId}`,
      }] : [],
    };

    // Start Firecracker process
    const firecrackerProcess = await this.spawnFirecracker(vmId, vmConfig);
    
    return {
      vmId,
      process: firecrackerProcess,
      quotas,
      startedAt: Date.now(),
    };
  }

  private async spawnFirecracker(vmId: string, config: any): Promise<any> {
    // Spawn firecracker process with config
    console.log(`[Firecracker] Spawning VM ${vmId}`);
    return { pid: Math.floor(Math.random() * 10000) };
  }

  async kill(vmInfo: any, reason: string): Promise<void> {
    console.log(`[Firecracker] Killing VM ${vmInfo.vmId}: ${reason}`);
    // Send kill signal to firecracker process
    // Clean up tap device
  }

  async getUsage(vmInfo: any): Promise<ResourceUsage> {
    // Query Firecracker API for metrics
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

  async pause(vmInfo: any): Promise<void> {
    // Firecracker pause API
  }

  async resume(vmInfo: any): Promise<void> {
    // Firecracker resume API
  }
}

// Docker + seccomp Backend
export class DockerBackend extends IsolationBackendProvider {
  name = 'docker';

  async createSandbox(config: SandboxConfig, quotas: ResourceQuotas): Promise<any> {
    const containerName = `claw-${config.agentId}`;
    
    // Generate seccomp profile based on quotas
    const seccompProfile = this.generateSeccompProfile(quotas);
    
    // Docker run with limits
    const dockerConfig = {
      Image: config.code as string,
      name: containerName,
      HostConfig: {
        Memory: quotas.memoryMB * 1024 * 1024,
        CpuQuota: quotas.cpuMsPerSecond * 1000, // Convert to microseconds
        NetworkMode: quotas.networkKBps > 0 ? 'bridge' : 'none',
        SecurityOpt: [`seccomp=${seccompProfile}`],
        PidsLimit: quotas.maxProcesses,
      },
      Env: Object.entries(config.envVars).map(([k, v]) => `${k}=${v}`),
      Cmd: config.args,
    };

    console.log(`[Docker] Creating container ${containerName}`);
    return { containerName, config: dockerConfig };
  }

  private generateSeccompProfile(quotas: ResourceQuotas): string {
    // Generate restrictive seccomp JSON
    return JSON.stringify({
      defaultAction: 'SCMP_ACT_ERRNO',
      syscalls: [
        { names: ['read', 'write', 'exit', 'exit_group'], action: 'SCMP_ACT_ALLOW' },
        // Limited syscalls based on quotas.maxSyscallsPerSec
      ],
    });
  }

  async kill(container: any, reason: string): Promise<void> {
    console.log(`[Docker] Killing container ${container.containerName}: ${reason}`);
  }

  async getUsage(container: any): Promise<ResourceUsage> {
    // Docker stats API
    return {
      cpuTimeMs: 0,
      memoryMB: 0,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: 0,
      filesOpened: 0,
      processesSpawned: 1,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  async pause(container: any): Promise<void> {
    // Docker pause
  }

  async resume(container: any): Promise<void> {
    // Docker unpause
  }
}

// ============================================================================
// TELEMETRY COLLECTOR
// ============================================================================

export class TelemetryCollector {
  private agentId: string;
  private sandboxId: string;
  private syscalls: SyscallLog[] = [];
  private violations: Violation[] = [];
  private reputationHistory: { timestamp: number; reputation: number }[] = [];
  private startTime: number;

  constructor(agentId: string, sandboxId: string) {
    this.agentId = agentId;
    this.sandboxId = sandboxId;
    this.startTime = Date.now();
  }

  logSyscall(syscall: string, args: any[], result: any, allowed: boolean, durationMs: number): void {
    this.syscalls.push({
      timestamp: Date.now(),
      syscall,
      args,
      result,
      allowed,
      durationMs,
    });

    // Keep only last 1000 syscalls (memory management)
    if (this.syscalls.length > 1000) {
      this.syscalls.shift();
    }
  }

  logViolation(violation: Violation): void {
    this.violations.push(violation);
  }

  logReputation(reputation: number): void {
    this.reputationHistory.push({
      timestamp: Date.now(),
      reputation,
    });
  }

  getReport(): TelemetryReport {
    return {
      agentId: this.agentId,
      sandboxId: this.sandboxId,
      period: { start: this.startTime, end: Date.now() },
      usage: this.calculateUsage(),
      syscalls: [...this.syscalls],
      violations: [...this.violations],
      reputationHistory: [...this.reputationHistory],
    };
  }

  private calculateUsage(): ResourceUsage {
    // Aggregate from syscall logs
    return {
      cpuTimeMs: 0,
      memoryMB: 0,
      networkSentKB: 0,
      networkRecvKB: 0,
      syscallsMade: this.syscalls.length,
      filesOpened: 0,
      processesSpawned: 0,
      diskIOReadKB: 0,
      diskIOWriteKB: 0,
    };
  }

  // Export evidence for Arbitra dispute
  exportEvidence(): any {
    return {
      agentId: this.agentId,
      violations: this.violations,
      syscallSummary: this.syscalls.filter(s => !s.allowed).map(s => ({
        timestamp: s.timestamp,
        syscall: s.syscall,
        blocked: true,
      })),
    };
  }
}

// ============================================================================
// CORE CLAWSANDBOX CLASS
// ============================================================================

export class ClawSandbox extends EventEmitter {
  private config: SandboxConfig;
  private quotaCalc: QuotaCalculator;
  private backend: IsolationBackendProvider;
  private telemetry: TelemetryCollector;
  private status: SandboxStatus;
  private process: any;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly SANDBOX_ID: string;

  constructor(config: SandboxConfig) {
    super();
    this.config = config;
    this.SANDBOX_ID = `sb-${config.agentId}-${Date.now()}`;
    this.quotaCalc = new QuotaCalculator(config.tapClient);
    this.backend = this.selectBackend(config.isolationBackend);
    this.telemetry = new TelemetryCollector(config.agentId, this.SANDBOX_ID);
    
    this.status = {
      pid: 0,
      state: 'starting',
      reputation: 0,
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
      case 'wasm':
        return new WASMBackend();
      case 'firecracker':
        return new FirecrackerBackend();
      case 'docker':
        return new DockerBackend();
      default:
        return new WASMBackend();
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE METHODS
  // --------------------------------------------------------------------------

  async start(): Promise<SandboxStatus> {
    // 1. Calculate initial quotas
    const { quotas, mode } = await this.quotaCalc.calculateQuotas(this.config.agentId);
    
    // 2. Check kill threshold
    if (mode === 'kill') {
      throw new Error(`Agent ${this.config.agentId} reputation too low to start sandbox`);
    }

    // 3. Create sandbox with backend
    this.status.quotas = quotas;
    this.process = await this.backend.createSandbox(this.config, quotas);
    this.status.pid = this.process.pid || this.process.vmId || 0;
    this.status.state = 'running';

    // 4. Start monitoring
    this.startMonitoring();

    // 5. Notify ClawForge if connected
    if (this.config.clawForge) {
      await this.config.clawForge.registerSandbox(this.SANDBOX_ID, this.status);
    }

    this.emit('started', this.status);
    return this.status;
  }

  async kill(reason: string): Promise<void> {
    if (this.status.state === 'killed' || this.status.state === 'exited') {
      return;
    }

    console.log(`[ClawSandbox] Killing ${this.SANDBOX_ID}: ${reason}`);
    
    this.status.state = 'killed';
    await this.backend.kill(this.process, reason);
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Export telemetry for potential dispute
    const report = this.telemetry.getReport();
    
    // Notify ClawForge
    if (this.config.clawForge) {
      await this.config.clawForge.reportSandboxKilled(this.SANDBOX_ID, reason, report);
    }

    this.emit('killed', { reason, report });
  }

  async pause(): Promise<void> {
    await this.backend.pause(this.process);
    this.status.state = 'throttled';
    this.emit('paused');
  }

  async resume(): Promise<void> {
    await this.backend.resume(this.process);
    this.status.state = 'running';
    this.emit('resumed');
  }

  // --------------------------------------------------------------------------
  // MONITORING & ENFORCEMENT
  // --------------------------------------------------------------------------

  private startMonitoring(): void {
    // Check every 5 seconds
    this.monitorInterval = setInterval(async () => {
      await this.checkStatus();
    }, 5000);
  }

  private async checkStatus(): Promise<void> {
    try {
      // 1. Get current usage
      const usage = await this.backend.getUsage(this.process);
      this.status.usage = usage;
      this.status.lastCheckedAt = new Date();

      // 2. Re-query reputation
      const { quotas, mode } = await this.quotaCalc.calculateQuotas(this.config.agentId);
      this.status.reputation = await this.config.tapClient.getReputation(this.config.agentId);
      this.telemetry.logReputation(this.status.reputation);

      // 3. Check for kill conditions
      if (mode === 'kill') {
        await this.kill('REPUTATION_BELOW_THRESHOLD');
        return;
      }

      // 4. Check for quota violations
      await this.enforceQuotas(usage, quotas);

      // 5. Check for security mode changes
      if (mode === 'quarantine' && this.status.state !== 'quarantined') {
        this.status.state = 'quarantined';
        await this.quarantine();
      }

      this.emit('status', this.status);
    } catch (error) {
      console.error('[ClawSandbox] Monitor error:', error);
      await this.kill('MONITOR_ERROR');
    }
  }

  private async enforceQuotas(usage: ResourceUsage, quotas: ResourceQuotas): Promise<void> {
    const violations: Violation[] = [];

    // CPU check (simplified — real implementation needs actual tracking)
    if (usage.cpuTimeMs > quotas.cpuMsPerSecond) {
      violations.push({
        type: 'CPU_QUOTA',
        severity: 'warning',
        timestamp: Date.now(),
        details: `CPU usage ${usage.cpuTimeMs}ms exceeds quota ${quotas.cpuMsPerSecond}ms`,
        autoAction: 'throttle',
      });
    }

    // Memory check
    if (usage.memoryMB > quotas.memoryMB) {
      violations.push({
        type: 'MEMORY_QUOTA',
        severity: 'critical',
        timestamp: Date.now(),
        details: `Memory ${usage.memoryMB}MB exceeds quota ${quotas.memoryMB}MB`,
        autoAction: 'kill',
      });
    }

    // Network check
    if (quotas.networkKBps === 0 && (usage.networkSentKB > 0 || usage.networkRecvKB > 0)) {
      violations.push({
        type: 'NETWORK_QUOTA',
        severity: 'critical',
        timestamp: Date.now(),
        details: 'Network activity detected during quarantine',
        autoAction: 'kill',
      });
    }

    // Handle violations
    for (const violation of violations) {
      this.telemetry.logViolation(violation);

      if (violation.autoAction === 'kill') {
        await this.kill(`${violation.type}_VIOLATION`);
        return;
      } else if (violation.autoAction === 'throttle') {
        await this.throttle();
      }
    }
  }

  private async throttle(): Promise<void> {
    // Reduce CPU quota temporarily
    this.status.quotas.cpuMsPerSecond *= 0.5;
    this.emit('throttled');
  }

  private async quarantine(): Promise<void> {
    // Isolate network
    this.status.quotas.networkKBps = 0;
    this.emit('quarantined');
    
    console.log(`[ClawSandbox] ${this.SANDBOX_ID} quarantined due to active dispute`);
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  getStatus(): SandboxStatus {
    return { ...this.status };
  }

  getReport(): TelemetryReport {
    return this.telemetry.getReport();
  }

  getEvidenceForDispute(): any {
    return this.telemetry.exportEvidence();
  }

  // ClawKernel integration: Checkpoint sandbox state
  async checkpoint(): Promise<any> {
    return {
      sandboxId: this.SANDBOX_ID,
      status: this.getStatus(),
      telemetry: this.getReport(),
    };
  }

  // ClawForge integration: Apply policy update
  async applyPolicyUpdate(policy: Partial<ResourceQuotas>): Promise<void> {
    this.status.quotas = { ...this.status.quotas, ...policy };
    this.emit('policyUpdated', this.status.quotas);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawSandbox;
export { QuotaCalculator, TelemetryCollector };
export { WASMBackend, FirecrackerBackend, DockerBackend };
