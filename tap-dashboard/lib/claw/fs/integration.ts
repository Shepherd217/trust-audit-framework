/**
 * ClawFS Integration Layer
 * Connects ClawFS with ClawKernel, ClawBus, and other MoltOS systems
 */

import { ClawFSService, FileObject, Permission, StorageTier } from './fs';
import { ClawBus, BusMessage } from '../bus';
import { ClawKernel, ProcessConfig } from '../kernel';

// ============================================================================
// ClawFS + ClawBus Integration
// ============================================================================

export interface FileOperationEvent {
  type: 'file_stored' | 'file_retrieved' | 'file_shared' | 'file_updated' | 
        'file_deleted' | 'permission_granted' | 'permission_revoked' |
        'tier_migrated' | 'conflict_detected' | 'conflict_resolved';
  fileId: string;
  agentId: string;
  timestamp: string;
  details: Record<string, any>;
}

/**
 * Broadcast file operations via ClawBus
 */
export class ClawFSBusIntegration {
  constructor(
    private fs: ClawFSService,
    private bus: ClawBus
  ) {}

  /**
   * Store file and broadcast event
   */
  async storeAndBroadcast(
    agentId: string,
    content: string,
    metadata: any,
    permissions?: Permission[]
  ): Promise<FileObject> {
    const file = await this.fs.store(agentId, content, metadata, permissions);
    
    // Broadcast to subscribers
    await this.bus.broadcast({
      type: 'file_stored',
      senderId: agentId,
      payload: {
        fileId: file.id,
        cid: file.cid,
        name: metadata.name,
        size: content.length,
        permissions: permissions?.length || 0
      },
      channels: [`fs:agent:${agentId}`, 'fs:public']
    });

    return file;
  }

  /**
   * Share file and notify recipient
   */
  async shareAndNotify(
    ownerId: string,
    fileId: string,
    targetAgentId: string,
    permissions: Permission
  ): Promise<void> {
    await this.fs.share(ownerId, fileId, targetAgentId, permissions);
    
    // Direct message to recipient
    await this.bus.send({
      type: 'file_shared',
      senderId: ownerId,
      recipientId: targetAgentId,
      payload: {
        fileId,
        permissions,
        sharedAt: new Date().toISOString()
      },
      priority: 'high'
    });
  }

  /**
   * Subscribe to file events for an agent
   */
  async subscribeToFileEvents(
    agentId: string,
    handler: (event: FileOperationEvent) => void
  ): Promise<void> {
    await this.bus.poll(agentId, (message: BusMessage) => {
      if (message.type.startsWith('file_')) {
        handler({
          type: message.type as FileOperationEvent['type'],
          fileId: message.payload.fileId,
          agentId: message.senderId,
          timestamp: message.timestamp,
          details: message.payload
        });
      }
    });
  }

  /**
   * Broadcast tier migration event
   */
  async broadcastTierMigration(
    fileId: string,
    fromTier: StorageTier,
    toTier: StorageTier,
    triggeredBy: string
  ): Promise<void> {
    await this.bus.broadcast({
      type: 'tier_migrated',
      senderId: triggeredBy,
      payload: {
        fileId,
        fromTier,
        toTier,
        migratedAt: new Date().toISOString()
      },
      channels: [`fs:file:${fileId}`, `fs:agent:${triggeredBy}`]
    });
  }
}

// ============================================================================
// ClawFS + ClawKernel Integration
// ============================================================================

export interface FSProcessConfig extends ProcessConfig {
  /** Agent ID that owns this process */
  agentId: string;
  /** Files to mount into process sandbox */
  mountFiles?: string[];
  /** Allow process to write to FS */
  allowWrite?: boolean;
  /** Directory to use as working dir */
  workingDir?: string;
}

/**
 * Mount ClawFS into ClawKernel processes
 */
export class ClawFSKernelIntegration {
  constructor(
    private fs: ClawFSService,
    private kernel: ClawKernel
  ) {}

  /**
   * Spawn process with FS access
   */
  async spawnWithFSAccess(config: FSProcessConfig): Promise<string> {
    // Pre-load files into process working directory
    const preloadedFiles: Record<string, string> = {};
    
    if (config.mountFiles) {
      for (const fileId of config.mountFiles) {
        const file = await this.fs.retrieve(config.agentId, fileId);
        preloadedFiles[file.metadata.name] = file.content as string;
      }
    }

    // Spawn process with FS context
    const processId = await this.kernel.spawn({
      name: config.name,
      command: config.command,
      args: config.args,
      env: {
        ...config.env,
        CLAWFS_AGENT_ID: config.agentId,
        CLAWFS_ALLOW_WRITE: config.allowWrite ? '1' : '0',
        CLAWFS_MOUNTED_FILES: JSON.stringify(Object.keys(preloadedFiles))
      },
      resources: config.resources
    });

    // Register process with FS hooks
    this.registerFSHooks(processId, config.agentId, config.allowWrite);

    return processId;
  }

  /**
   * Register FS hooks for a process
   */
  private registerFSHooks(
    processId: string, 
    agentId: string, 
    allowWrite?: boolean
  ): void {
    // Hook into process stdin/stdout for FS operations
    // This would be implemented via the kernel's IPC mechanism
    const kernel = this.kernel;
    
    // Example: Process requests file read
    kernel.onProcessMessage(processId, async (message: any) => {
      if (message.type === 'fs:read') {
        try {
          const file = await this.fs.retrieve(agentId, message.fileId);
          kernel.sendToProcess(processId, {
            type: 'fs:read:response',
            requestId: message.requestId,
            success: true,
            data: file.content
          });
        } catch (error) {
          kernel.sendToProcess(processId, {
            type: 'fs:read:response',
            requestId: message.requestId,
            success: false,
            error: (error as Error).message
          });
        }
      }

      if (message.type === 'fs:write' && allowWrite) {
        try {
          const file = await this.fs.store(
            agentId,
            message.content,
            message.metadata,
            message.permissions
          );
          kernel.sendToProcess(processId, {
            type: 'fs:write:response',
            requestId: message.requestId,
            success: true,
            fileId: file.id
          });
        } catch (error) {
          kernel.sendToProcess(processId, {
            type: 'fs:write:response',
            requestId: message.requestId,
            success: false,
            error: (error as Error).message
          });
        }
      }
    });
  }

  /**
   * Get process output as file
   */
  async captureOutputAsFile(
    processId: string,
    agentId: string,
    metadata: any
  ): Promise<FileObject> {
    const process = await this.kernel.getStatus(processId);
    
    if (process.status !== 'completed') {
      throw new Error('Process not completed');
    }

    // Store stdout as file
    return await this.fs.store(
      agentId,
      process.stdout || '',
      {
        ...metadata,
        source: 'process',
        processId,
        exitCode: process.exitCode
      }
    );
  }
}

// ============================================================================
// Arbitra Integration
// ============================================================================

export interface DisputeEvidence {
  disputeId: string;
  submittedBy: string;
  evidenceType: 'file' | 'log' | 'message' | 'proof';
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
}

/**
 * ClawFS integration for Arbitra dispute resolution
 */
export class ClawFSArbitraIntegration {
  constructor(private fs: ClawFSService) {}

  /**
   * Store dispute evidence immutably
   */
  async storeEvidence(
    disputeId: string,
    submittedBy: string,
    evidence: Omit<DisputeEvidence, 'disputeId' | 'submittedBy'>
  ): Promise<FileObject> {
    const content = JSON.stringify({
      ...evidence,
      disputeId,
      submittedBy,
      submittedAt: new Date().toISOString()
    });

    // Store with special metadata for disputes
    const file = await this.fs.store(
      submittedBy,
      content,
      {
        name: `dispute-${disputeId}-evidence-${Date.now()}`,
        mimeType: 'application/json',
        disputeId,
        evidenceType: evidence.evidenceType,
        submittedBy,
        immutable: true // Flag for dispute evidence
      },
      [
        // Dispute panel has read access
        {
          agentId: `arbitra:panel:${disputeId}`,
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
          grantedAt: new Date(),
          grantedBy: submittedBy
        }
      ]
    );

    return file;
  }

  /**
   * Retrieve all evidence for a dispute
   */
  async getDisputeEvidence(disputeId: string): Promise<FileObject[]> {
    // Search for files with dispute metadata
    return await this.fs.list('arbitra:system', {
      tags: [`dispute:${disputeId}`]
    });
  }

  /**
   * Store dispute resolution verdict
   */
  async storeVerdict(
    disputeId: string,
    verdict: {
      decision: 'upheld' | 'rejected' | 'split';
      reasoning: string;
      penalties: Array<{ agentId: string; karma: number }>;
      restitution?: { from: string; to: string; amount: number };
    }
  ): Promise<FileObject> {
    const content = JSON.stringify({
      disputeId,
      verdict,
      resolvedAt: new Date().toISOString()
    });

    return await this.fs.store(
      'arbitra:system',
      content,
      {
        name: `dispute-${disputeId}-verdict`,
        mimeType: 'application/json',
        disputeId,
        evidenceType: 'verdict',
        immutable: true
      }
    );
  }

  /**
   * Export dispute package for external review
   */
  async exportDisputePackage(disputeId: string): Promise<FileObject> {
    const evidence = await this.getDisputeEvidence(disputeId);
    
    const packageContent = JSON.stringify({
      disputeId,
      exportedAt: new Date().toISOString(),
      evidence: evidence.map(e => ({
        fileId: e.id,
        cid: e.cid,
        submittedBy: e.metadata.submittedBy,
        evidenceType: e.metadata.evidenceType,
        timestamp: e.createdAt
      }))
    }, null, 2);

    return await this.fs.store(
      'arbitra:system',
      packageContent,
      {
        name: `dispute-${disputeId}-package`,
        mimeType: 'application/json',
        disputeId,
        packageType: 'export'
      }
    );
  }
}

// ============================================================================
// TAP Integration
// ============================================================================

export interface AttestationEvidence {
  attestationId: string;
  attesterId: string;
  targetAgentId: string;
  claim: string;
  proof?: string;
  timestamp: string;
}

/**
 * ClawFS integration for TAP attestations
 */
export class ClawFSTAPIntegration {
  constructor(private fs: ClawFSService) {}

  /**
   * Store attestation with proof
   */
  async storeAttestation(
    attestation: AttestationEvidence
  ): Promise<FileObject> {
    const content = JSON.stringify(attestation, null, 2);

    return await this.fs.store(
      attestation.attesterId,
      content,
      {
        name: `attestation-${attestation.attestationId}`,
        mimeType: 'application/json',
        attestationId: attestation.attestationId,
        attesterId: attestation.attesterId,
        targetAgentId: attestation.targetAgentId,
        tags: ['attestation', `target:${attestation.targetAgentId}`]
      }
    );
  }

  /**
   * Get all attestations for an agent
   */
  async getAgentAttestations(agentId: string): Promise<FileObject[]> {
    return await this.fs.list(agentId, {
      tags: ['attestation', `target:${agentId}`]
    });
  }

  /**
   * Store reputation audit trail
   */
  async storeReputationAudit(
    agentId: string,
    event: {
      type: 'karma_change' | 'tier_upgrade' | 'tier_downgrade' | 'strike';
      amount?: number;
      reason: string;
      triggeredBy: string;
    }
  ): Promise<FileObject> {
    const content = JSON.stringify({
      agentId,
      ...event,
      timestamp: new Date().toISOString()
    });

    return await this.fs.store(
      'tap:system',
      content,
      {
        name: `reputation-${agentId}-${Date.now()}`,
        mimeType: 'application/json',
        agentId,
        eventType: event.type,
        tags: ['reputation', `agent:${agentId}`],
        immutable: true
      }
    );
  }
}

// ============================================================================
// Unified Integration Export
// ============================================================================

export class ClawFSIntegrations {
  public bus: ClawFSBusIntegration;
  public kernel: ClawFSKernelIntegration;
  public arbitra: ClawFSArbitraIntegration;
  public tap: ClawFSTAPIntegration;

  constructor(
    fs: ClawFSService,
    bus: ClawBus,
    kernel: ClawKernel
  ) {
    this.bus = new ClawFSBusIntegration(fs, bus);
    this.kernel = new ClawFSKernelIntegration(fs, kernel);
    this.arbitra = new ClawFSArbitraIntegration(fs);
    this.tap = new ClawFSTAPIntegration(fs);
  }
}

export default ClawFSIntegrations;
