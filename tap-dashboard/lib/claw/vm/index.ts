// @ts-nocheck

/**
 * ClawVM Service
 * Hardware-isolated agent runtime using Firecracker microVMs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  VMConfig,
  VMInstance,
  VMState,
  ResourceTier,
  ResourceQuota,
  TIER_QUOTAS,
  VMSnapshot,
  VMMetrics,
  VMFilters,
  VMInstanceRow,
  VMSnapshotRow
} from './types';
import * as firecracker from './firecracker';

// Configuration
const FIRECRACKER_SOCKET_DIR = process.env.FIRECRACKER_SOCKET_DIR || '/tmp/clawvm';
const FIRECRACKER_KERNEL_PATH = process.env.FIRECRACKER_KERNEL_PATH || '/opt/clawvm/vmlinux';
const FIRECRACKER_ROOTFS_PATH = process.env.FIRECRACKER_ROOTFS_PATH || '/opt/clawvm/rootfs.ext4';

export class ClawVMService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.ensureSocketDir();
  }

  private ensureSocketDir(): void {
    if (!fs.existsSync(FIRECRACKER_SOCKET_DIR)) {
      fs.mkdirSync(FIRECRACKER_SOCKET_DIR, { recursive: true });
    }
  }

  private getSocketPath(vmId: string): string {
    return path.join(FIRECRACKER_SOCKET_DIR, `${vmId}.sock`);
  }

  private generateVMId(): string {
    return `vm-${uuidv4()}`;
  }

  /**
   * Spawn a new microVM for an agent
   */
  async spawnVM(agentId: string, tier: ResourceTier): Promise<VMInstance> {
    const vmId = this.generateVMId();
    const socketPath = this.getSocketPath(vmId);
    const quota = TIER_QUOTAS[tier];

    // Create VM configuration
    const config: VMConfig = {
      id: vmId,
      agentId,
      tier,
      vcpuCount: quota.vcpuCount,
      memoryMB: quota.memoryMB,
      diskMB: quota.diskMB,
      kernelImagePath: FIRECRACKER_KERNEL_PATH,
      rootfsPath: FIRECRACKER_ROOTFS_PATH,
      socketPath,
      logPath: path.join(FIRECRACKER_SOCKET_DIR, `${vmId}.log`),
      env: {
        CLAWVM_VM_ID: vmId,
        CLAWVM_AGENT_ID: agentId,
        CLAWVM_TIER: tier,
      },
    };

    // Create VM in Firecracker
    await firecracker.createVM(socketPath, {
      machineConfig: {
        vcpu_count: config.vcpuCount,
        mem_size_mib: config.memoryMB,
        smt: false,
      },
    });

    // Configure drives
    const fullConfig: firecracker.FullVMConfig = {
      machineConfig: {
        vcpu_count: config.vcpuCount,
        mem_size_mib: config.memoryMB,
        smt: false,
      },
      drives: [{
        drive_id: 'rootfs',
        path_on_host: config.rootfsPath,
        is_root_device: true,
        is_read_only: false,
      }],
    };
    await firecracker.configureVM(socketPath, fullConfig);

    // Start the VM
    await firecracker.startVM(socketPath);

    // Create database record
    const instance: VMInstance = {
      id: vmId,
      agentId,
      tier,
      state: VMState.RUNNING,
      config,
      createdAt: new Date(),
      startedAt: new Date(),
      restartCount: 0,
    };

    const { error } = await this.supabase.from('claw_vms').insert({
      id: vmId,
      agent_id: agentId,
      tier,
      state: 'running',
      config,
      socket_path: socketPath,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    });

    if (error) {
      // Cleanup on error
      await this.cleanupVM(vmId, socketPath);
      throw new Error(`Failed to create VM record: ${error.message}`);
    }

    return instance;
  }

  /**
   * Kill (stop) a VM
   */
  async killVM(vmId: string): Promise<void> {
    const socketPath = this.getSocketPath(vmId);

    // Get current state
    const { data: vm, error: fetchError } = await this.supabase
      .from('claw_vms')
      .select('*')
      .eq('id', vmId)
      .single();

    if (fetchError || !vm) {
      throw new Error(`VM not found: ${vmId}`);
    }

    // Stop via Firecracker
    try {
      await firecracker.stopVM(socketPath);
    } catch (err) {
      console.warn(`Failed to gracefully stop VM ${vmId}, forcing cleanup`);
    }

    // Update database
    const { error } = await this.supabase
      .from('claw_vms')
      .update({
        state: 'stopped',
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', vmId);

    if (error) {
      throw new Error(`Failed to update VM state: ${error.message}`);
    }

    // Cleanup socket file
    await this.cleanupVM(vmId, socketPath);
  }

  /**
   * Get VM status
   */
  async getVMStatus(vmId: string): Promise<VMInstance> {
    const { data: vm, error } = await this.supabase
      .from('claw_vms')
      .select('*')
      .eq('id', vmId)
      .single();

    if (error || !vm) {
      throw new Error(`VM not found: ${vmId}`);
    }

    // Get live state from Firecracker if running
    let liveState = vm.state;
    if (vm.socket_path && fs.existsSync(vm.socket_path)) {
      try {
        liveState = await firecracker.getVMState(vm.socket_path);
      } catch {
        // Firecracker not responding, VM may have crashed
        liveState = 'crashed';
      }
    }

    return this.mapRowToInstance(vm, liveState);
  }

  /**
   * Pause a VM
   */
  async pauseVM(vmId: string): Promise<void> {
    const socketPath = this.getSocketPath(vmId);
    await firecracker.pauseVM(socketPath);

    await this.supabase
      .from('claw_vms')
      .update({ state: 'paused', updated_at: new Date().toISOString() })
      .eq('id', vmId);
  }

  /**
   * Resume a paused VM
   */
  async resumeVM(vmId: string): Promise<void> {
    const socketPath = this.getSocketPath(vmId);
    await firecracker.resumeVM(socketPath);

    await this.supabase
      .from('claw_vms')
      .update({ state: 'running', updated_at: new Date().toISOString() })
      .eq('id', vmId);
  }

  /**
   * Create a snapshot of a VM
   */
  async createSnapshot(vmId: string): Promise<VMSnapshot> {
    const socketPath = this.getSocketPath(vmId);
    const snapshotId = `snap-${uuidv4()}`;
    const snapshotDir = path.join(FIRECRACKER_SOCKET_DIR, 'snapshots');
    
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const memoryPath = path.join(snapshotDir, `${snapshotId}-mem`);
    const diskPath = path.join(snapshotDir, `${snapshotId}-disk`);

    // Create snapshot via Firecracker
    await firecracker.createSnapshot(socketPath, memoryPath);

    // Copy disk snapshot
    const vm = await this.getVMStatus(vmId);
    fs.copyFileSync(vm.config.rootfsPath, diskPath);

    // Create snapshot record
    const snapshot: VMSnapshot = {
      id: snapshotId,
      vmId,
      agentId: vm.agentId,
      createdAt: new Date(),
      memorySnapshotPath: memoryPath,
      diskSnapshotPath: diskPath,
      vmStateSnapshotPath: memoryPath + '.state',
      sizeBytes: fs.statSync(memoryPath).size + fs.statSync(diskPath).size,
      restoredCount: 0,
    };

    await this.supabase.from('claw_vm_snapshots').insert({
      id: snapshotId,
      vm_id: vmId,
      agent_id: vm.agentId,
      memory_snapshot_path: memoryPath,
      disk_snapshot_path: diskPath,
      vm_state_snapshot_path: snapshot.vmStateSnapshotPath,
      size_bytes: snapshot.sizeBytes,
      created_at: new Date().toISOString(),
      restored_count: 0,
    });

    return snapshot;
  }

  /**
   * Restore VM from snapshot
   */
  async restoreVM(snapshotId: string): Promise<VMInstance> {
    const { data: snap, error } = await this.supabase
      .from('claw_vm_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (error || !snap) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Create new VM from snapshot
    const newVM = await this.spawnVM(snap.agent_id, snap.vm?.tier || ResourceTier.MEDIUM);

    // Load snapshot into new VM
    await firecracker.loadSnapshot(this.getSocketPath(newVM.id), snap.memory_snapshot_path);

    // Update restored count
    await this.supabase
      .from('claw_vm_snapshots')
      .update({
        restored_count: snap.restored_count + 1,
        last_restored_at: new Date().toISOString(),
      })
      .eq('id', snapshotId);

    return newVM;
  }

  /**
   * List VMs with filters
   */
  async listVMs(filters?: VMFilters): Promise<VMInstance[]> {
    let query = this.supabase.from('claw_vms').select('*');

    if (filters?.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }
    if (filters?.state) {
      const states = Array.isArray(filters.state) ? filters.state : [filters.state];
      query = query.in('state', states);
    }
    if (filters?.tier) {
      const tiers = Array.isArray(filters.tier) ? filters.tier : [filters.tier];
      query = query.in('tier', tiers);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list VMs: ${error.message}`);
    }

    return (data || []).map(row => this.mapRowToInstance(row));
  }

  /**
   * Get resource usage metrics
   */
  async getResourceUsage(vmId: string): Promise<VMMetrics | null> {
    const { data, error } = await this.supabase
      .from('claw_vm_metrics')
      .select('*')
      .eq('vm_id', vmId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      vmId: data.vm_id,
      timestamp: new Date(data.timestamp),
      cpu: {
        userTimeUs: data.cpu_user_time_us || 0,
        systemTimeUs: data.cpu_system_time_us || 0,
        totalTimeUs: data.cpu_total_time_us || 0,
        usagePercent: data.cpu_usage_percent || 0,
      },
      memory: {
        totalMB: data.memory_total_mb || 0,
        usedMB: data.memory_used_mb || 0,
        availableMB: data.memory_available_mb || 0,
        usagePercent: data.memory_usage_percent || 0,
      },
      disk: {
        readBytes: data.disk_read_bytes || 0,
        writeBytes: data.disk_write_bytes || 0,
        readOps: data.disk_read_ops || 0,
        writeOps: data.disk_write_ops || 0,
      },
      network: {
        rxBytes: data.network_rx_bytes || 0,
        txBytes: data.network_tx_bytes || 0,
        rxPackets: data.network_rx_packets || 0,
        txPackets: data.network_tx_packets || 0,
      },
    };
  }

  private async cleanupVM(vmId: string, socketPath: string): Promise<void> {
    try {
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
      const logPath = path.join(FIRECRACKER_SOCKET_DIR, `${vmId}.log`);
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
    } catch (err) {
      console.warn(`Cleanup warning for VM ${vmId}:`, err);
    }
  }

  private mapRowToInstance(row: VMInstanceRow, liveState?: string): VMInstance {
    return {
      id: row.id,
      agentId: row.agent_id,
      tier: row.tier as ResourceTier,
      state: (liveState || row.state) as VMState,
      config: row.config,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      pid: row.pid,
      exitCode: row.exit_code,
      errorMessage: row.error_message,
      snapshotId: row.snapshot_id,
      restartCount: row.restart_count,
    };
  }
}

// Factory function for convenience
export function createClawVMService(supabase: SupabaseClient): ClawVMService {
  return new ClawVMService(supabase);
}

// Export all methods for individual use
export const spawnVM = (supabase: SupabaseClient, agentId: string, tier: ResourceTier) =>
  new ClawVMService(supabase).spawnVM(agentId, tier);

export const killVM = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).killVM(vmId);

export const getVMStatus = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).getVMStatus(vmId);

export const pauseVM = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).pauseVM(vmId);

export const resumeVM = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).resumeVM(vmId);

export const createSnapshot = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).createSnapshot(vmId);

export const restoreVM = (supabase: SupabaseClient, snapshotId: string) =>
  new ClawVMService(supabase).restoreVM(snapshotId);

export const listVMs = (supabase: SupabaseClient, filters?: VMFilters) =>
  new ClawVMService(supabase).listVMs(filters);

export const getResourceUsage = (supabase: SupabaseClient, vmId: string) =>
  new ClawVMService(supabase).getResourceUsage(vmId);
