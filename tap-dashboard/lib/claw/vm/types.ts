// @ts-nocheck

/**
 * ClawVM Types
 * Core type definitions for the Agent MicroVM Manager
 */

export enum VMState {
  SPAWNED = 'spawned',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  CRASHED = 'crashed',
  SNAPSHOTTING = 'snapshotting',
  RESTORING = 'restoring',
}

export enum ResourceTier {
  TINY = 'tiny',       // 0.25 vCPU, 128 MB
  SMALL = 'small',     // 0.5 vCPU, 256 MB
  MEDIUM = 'medium',   // 1 vCPU, 512 MB
  LARGE = 'large',     // 2 vCPU, 1024 MB
  XLARGE = 'xlarge',   // 4 vCPU, 2048 MB
}

export interface ResourceQuota {
  vcpuCount: number;
  memoryMB: number;
  diskMB: number;
  bandwidthMbps: number;
}

export const TIER_QUOTAS: Record<ResourceTier, ResourceQuota> = {
  [ResourceTier.TINY]: {
    vcpuCount: 1,
    memoryMB: 128,
    diskMB: 512,
    bandwidthMbps: 10,
  },
  [ResourceTier.SMALL]: {
    vcpuCount: 1,
    memoryMB: 256,
    diskMB: 1024,
    bandwidthMbps: 25,
  },
  [ResourceTier.MEDIUM]: {
    vcpuCount: 1,
    memoryMB: 512,
    diskMB: 2048,
    bandwidthMbps: 50,
  },
  [ResourceTier.LARGE]: {
    vcpuCount: 2,
    memoryMB: 1024,
    diskMB: 4096,
    bandwidthMbps: 100,
  },
  [ResourceTier.XLARGE]: {
    vcpuCount: 4,
    memoryMB: 2048,
    diskMB: 8192,
    bandwidthMbps: 200,
  },
};

export interface VMConfig {
  id: string;
  agentId: string;
  tier: ResourceTier;
  vcpuCount: number;
  memoryMB: number;
  diskMB: number;
  kernelImagePath: string;
  rootfsPath: string;
  socketPath: string;
  logPath: string;
  networkInterface?: NetworkConfig;
  env?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface NetworkConfig {
  ifaceId: string;
  hostDevName: string;
  guestMac?: string;
  ipAddress?: string;
  gateway?: string;
}

export interface VMInstance {
  id: string;
  agentId: string;
  tier: ResourceTier;
  state: VMState;
  config: VMConfig;
  createdAt: Date;
  startedAt?: Date;
  lastHeartbeat?: Date;
  pid?: number;
  exitCode?: number;
  errorMessage?: string;
  snapshotId?: string;
  restartCount: number;
  resourceUsage?: VMResourceUsage;
}

export interface VMSnapshot {
  id: string;
  vmId: string;
  agentId: string;
  createdAt: Date;
  memorySnapshotPath: string;
  diskSnapshotPath: string;
  vmStateSnapshotPath: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
  restoredCount: number;
  lastRestoredAt?: Date;
}

export interface VMResourceUsage {
  cpuTimeUs: number;
  memoryUsageMB: number;
  diskReadBytes: number;
  diskWriteBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  timestamp: Date;
}

export interface VMMetrics {
  vmId: string;
  timestamp: Date;
  cpu: {
    userTimeUs: number;
    systemTimeUs: number;
    totalTimeUs: number;
    usagePercent: number;
  };
  memory: {
    totalMB: number;
    usedMB: number;
    availableMB: number;
    usagePercent: number;
  };
  disk: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
  };
}

export interface VMFilters {
  agentId?: string;
  state?: VMState | VMState[];
  tier?: ResourceTier | ResourceTier[];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface VMEvent {
  id: string;
  type: 'vm_spawned' | 'vm_started' | 'vm_paused' | 'vm_resumed' | 'vm_stopped' | 'vm_crashed' | 'vm_snapshot_created' | 'vm_restored' | 'vm_resource_usage';
  vmId: string;
  agentId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  vmId: string;
  agentId: string;
  userId?: string;
  timestamp: Date;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Database row types for Supabase
export interface VMInstanceRow {
  id: string;
  agent_id: string;
  tier: string;
  state: string;
  config: any;
  created_at: string;
  started_at?: string;
  last_heartbeat?: string;
  pid?: number;
  exit_code?: number;
  error_message?: string;
  snapshot_id?: string;
  restart_count: number;
  resource_usage?: any;
}

export interface VMSnapshotRow {
  id: string;
  vm_id: string;
  agent_id: string;
  created_at: string;
  memory_snapshot_path: string;
  disk_snapshot_path: string;
  vm_state_snapshot_path: string;
  size_bytes: number;
  metadata?: any;
  restored_count: number;
  last_restored_at?: string;
}

export interface VMAuditLogRow {
  id: string;
  action: string;
  vm_id: string;
  agent_id: string;
  user_id?: string;
  timestamp: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
}
