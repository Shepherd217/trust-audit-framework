/**
 * ClawScheduler Integration Layer
 * Connects ClawScheduler to other MoltOS systems
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Task {
  id: string;
  agentId: string;
  type: string;
  payload: unknown;
  priority: number;
  deadline?: Date;
  escrowAmount?: bigint;
}

export interface TaskResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface Execution {
  id: string;
  taskId: string;
  agentId: string;
  state: ExecutionState;
  startedAt: Date;
  completedAt?: Date;
}

export type ExecutionState = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface ExecutionEvent {
  type: 'state_change' | 'progress' | 'error' | 'checkpoint';
  timestamp: Date;
  data: unknown;
}

export interface AgentResponse {
  agentId: string;
  taskId: string;
  result: TaskResult;
  timestamp: Date;
}

export interface Checkpoint {
  executionId: string;
  state: ExecutionState;
  data: unknown;
  timestamp: Date;
}

export interface AuditLog {
  integration: string;
  action: string;
  status: 'success' | 'error';
  details?: unknown;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// Audit Trail Logger
// ============================================================================

class AuditTrail {
  private logs: AuditLog[] = [];

  log(integration: string, action: string, status: 'success' | 'error', details?: unknown, error?: string): void {
    const logEntry: AuditLog = {
      integration,
      action,
      status,
      details,
      error,
      timestamp: new Date()
    };
    this.logs.push(logEntry);
    
    // In production, this would write to persistent storage
    console.log(`[AUDIT] ${integration}.${action}: ${status}`, error || '');
  }

  getLogs(): AuditLog[] {
    return [...this.logs];
  }
}

const auditTrail = new AuditTrail();

// ============================================================================
// 1. ClawSchedulerBusIntegration
// ============================================================================

/**
 * Message Bus Integration for ClawScheduler
 * Handles pub/sub for task assignments and completions
 */
export class ClawSchedulerBusIntegration extends EventEmitter {
  private agentHandlers: Map<string, (response: AgentResponse) => void> = new Map();
  private connected = false;

  constructor() {
    super();
  }

  /**
   * Broadcast a task assignment to the message bus
   */
  async publishTaskAssignment(task: Task): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        topic: 'scheduler.task.assigned',
        payload: {
          taskId: task.id,
          agentId: task.agentId,
          type: task.type,
          payload: task.payload,
          priority: task.priority,
          deadline: task.deadline
        },
        timestamp: new Date().toISOString()
      };

      // Simulate message bus publish
      await this.publishToBus(message);
      
      auditTrail.log('BusIntegration', 'publishTaskAssignment', 'success', { taskId: task.id });
      this.emit('taskPublished', task);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('BusIntegration', 'publishTaskAssignment', 'error', { taskId: task.id }, errorMsg);
      throw new Error(`Failed to publish task assignment: ${errorMsg}`);
    }
  }

  /**
   * Broadcast task completion to the message bus
   */
  async publishTaskCompleted(task: Task, result: TaskResult): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        topic: 'scheduler.task.completed',
        payload: {
          taskId: task.id,
          agentId: task.agentId,
          success: result.success,
          output: result.output,
          error: result.error,
          executionTimeMs: result.executionTimeMs
        },
        timestamp: new Date().toISOString()
      };

      await this.publishToBus(message);
      
      auditTrail.log('BusIntegration', 'publishTaskCompleted', 'success', { 
        taskId: task.id, 
        success: result.success 
      });
      this.emit('taskCompleted', task, result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('BusIntegration', 'publishTaskCompleted', 'error', { taskId: task.id }, errorMsg);
      throw new Error(`Failed to publish task completion: ${errorMsg}`);
    }
  }

  /**
   * Subscribe to agent responses for a specific agent
   */
  subscribeToAgentResponses(agentId: string, handler: (response: AgentResponse) => void): () => void {
    try {
      this.agentHandlers.set(agentId, handler);
      
      // Set up subscription
      const subscription = this.subscribeToBus(`agent.${agentId}.response`, (msg: unknown) => {
        const response = msg as AgentResponse;
        if (response.agentId === agentId) {
          handler(response);
        }
      });

      auditTrail.log('BusIntegration', 'subscribeToAgentResponses', 'success', { agentId });
      
      // Return unsubscribe function
      return () => {
        this.agentHandlers.delete(agentId);
        subscription();
        auditTrail.log('BusIntegration', 'unsubscribeAgentResponses', 'success', { agentId });
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('BusIntegration', 'subscribeToAgentResponses', 'error', { agentId }, errorMsg);
      throw new Error(`Failed to subscribe to agent responses: ${errorMsg}`);
    }
  }

  /**
   * Broadcast execution state change event
   */
  async publishExecutionEvent(execution: Execution, event: ExecutionEvent): Promise<void> {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        topic: 'scheduler.execution.event',
        payload: {
          executionId: execution.id,
          taskId: execution.taskId,
          agentId: execution.agentId,
          state: execution.state,
          eventType: event.type,
          eventData: event.data,
          timestamp: event.timestamp.toISOString()
        }
      };

      await this.publishToBus(message);
      
      auditTrail.log('BusIntegration', 'publishExecutionEvent', 'success', { 
        executionId: execution.id,
        eventType: event.type 
      });
      this.emit('executionEvent', execution, event);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('BusIntegration', 'publishExecutionEvent', 'error', { executionId: execution.id }, errorMsg);
      throw new Error(`Failed to publish execution event: ${errorMsg}`);
    }
  }

  // Private helper methods
  private async connect(): Promise<void> {
    // Simulate connection to message bus
    this.connected = true;
    auditTrail.log('BusIntegration', 'connect', 'success');
  }

  private async publishToBus(message: unknown): Promise<void> {
    // Simulate publishing to message bus
    // In production, this would use MQTT, AMQP, or similar
    return Promise.resolve();
  }

  private subscribeToBus(topic: string, handler: (msg: unknown) => void): () => void {
    // Simulate subscription
    // Return unsubscribe function
    return () => {};
  }
}

// ============================================================================
// 2. ClawSchedulerKernelIntegration
// ============================================================================

/**
 * Kernel Integration for ClawScheduler
 * Manages sandboxed process execution
 */
export class ClawSchedulerKernelIntegration {
  private processes: Map<string, KernelProcess> = new Map();

  /**
   * Execute a task in a sandboxed kernel process
   */
  async executeInSandbox(executionId: string, node: string, agentId: string): Promise<string> {
    try {
      // Spawn kernel process
      const processId = `kernel-${executionId}-${Date.now()}`;
      
      const process: KernelProcess = {
        id: processId,
        executionId,
        node,
        agentId,
        status: 'starting',
        stdout: [],
        stderr: [],
        startTime: new Date()
      };

      this.processes.set(processId, process);

      // Simulate kernel spawn
      await this.spawnKernel(processId, node, agentId);
      process.status = 'running';

      auditTrail.log('KernelIntegration', 'executeInSandbox', 'success', { 
        executionId, 
        processId,
        node 
      });

      return processId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('KernelIntegration', 'executeInSandbox', 'error', { executionId, node }, errorMsg);
      throw new Error(`Failed to execute in sandbox: ${errorMsg}`);
    }
  }

  /**
   * Mount workflow state volumes for a process
   */
  async mountWorkflowState(processId: string, executionId: string): Promise<void> {
    try {
      const process = this.processes.get(processId);
      if (!process) {
        throw new Error(`Process ${processId} not found`);
      }

      // Mount execution state volume
      await this.mountVolume(processId, {
        name: 'execution-state',
        source: `/var/clawfs/executions/${executionId}`,
        target: '/mnt/execution',
        readonly: false
      });

      // Mount workflow inputs
      await this.mountVolume(processId, {
        name: 'workflow-inputs',
        source: `/var/clawfs/workflows/inputs/${executionId}`,
        target: '/mnt/inputs',
        readonly: true
      });

      auditTrail.log('KernelIntegration', 'mountWorkflowState', 'success', { 
        processId, 
        executionId 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('KernelIntegration', 'mountWorkflowState', 'error', { processId, executionId }, errorMsg);
      throw new Error(`Failed to mount workflow state: ${errorMsg}`);
    }
  }

  /**
   * Capture and stream agent output (stdout/stderr)
   */
  async captureAgentOutput(processId: string): Promise<ReadableStream<string>> {
    try {
      const process = this.processes.get(processId);
      if (!process) {
        throw new Error(`Process ${processId} not found`);
      }

      // Create readable stream for output
      const stream = new ReadableStream<string>({
        start: (controller) => {
          // Set up output capture
          this.setupOutputCapture(processId, (chunk: string, isError: boolean) => {
            if (isError) {
              process.stderr.push(chunk);
            } else {
              process.stdout.push(chunk);
            }
            controller.enqueue(chunk);
          });

          // Handle process end
          setTimeout(() => {
            controller.close();
          }, 100);
        }
      });

      auditTrail.log('KernelIntegration', 'captureAgentOutput', 'success', { processId });
      return stream;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('KernelIntegration', 'captureAgentOutput', 'error', { processId }, errorMsg);
      throw new Error(`Failed to capture agent output: ${errorMsg}`);
    }
  }

  // Private helper methods
  private async spawnKernel(processId: string, node: string, agentId: string): Promise<void> {
    // Simulate kernel process spawn
    return Promise.resolve();
  }

  private async mountVolume(processId: string, volume: Volume): Promise<void> {
    // Simulate volume mount
    return Promise.resolve();
  }

  private setupOutputCapture(processId: string, callback: (chunk: string, isError: boolean) => void): void {
    // Simulate output capture setup
  }
}

interface KernelProcess {
  id: string;
  executionId: string;
  node: string;
  agentId: string;
  status: 'starting' | 'running' | 'completed' | 'failed';
  stdout: string[];
  stderr: string[];
  startTime: Date;
  endTime?: Date;
}

interface Volume {
  name: string;
  source: string;
  target: string;
  readonly: boolean;
}

// ============================================================================
// 3. ClawSchedulerFSIntegration
// ============================================================================

/**
 * Filesystem Integration for ClawScheduler
 * Handles checkpointing, logs, and artifacts
 */
export class ClawSchedulerFSIntegration {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private logStreams: Map<string, string[]> = new Map();

  /**
   * Save execution state checkpoint to ClawFS
   */
  async checkpointExecution(execution: Execution): Promise<void> {
    try {
      const checkpoint: Checkpoint = {
        executionId: execution.id,
        state: execution.state,
        data: {
          taskId: execution.taskId,
          agentId: execution.agentId,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt
        },
        timestamp: new Date()
      };

      // Persist checkpoint to ClawFS
      await this.writeToClawFS(
        `/var/clawfs/checkpoints/${execution.id}/latest.json`,
        JSON.stringify(checkpoint)
      );

      // Also save as historical checkpoint
      const timestamp = Date.now();
      await this.writeToClawFS(
        `/var/clawfs/checkpoints/${execution.id}/${timestamp}.json`,
        JSON.stringify(checkpoint)
      );

      this.checkpoints.set(execution.id, checkpoint);

      auditTrail.log('FSIntegration', 'checkpointExecution', 'success', { 
        executionId: execution.id,
        state: execution.state 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('FSIntegration', 'checkpointExecution', 'error', { executionId: execution.id }, errorMsg);
      throw new Error(`Failed to checkpoint execution: ${errorMsg}`);
    }
  }

  /**
   * Restore execution from checkpoint
   */
  async restoreExecution(executionId: string): Promise<Execution> {
    try {
      const checkpointData = await this.readFromClawFS(
        `/var/clawfs/checkpoints/${executionId}/latest.json`
      );

      if (!checkpointData) {
        throw new Error(`No checkpoint found for execution ${executionId}`);
      }

      const checkpoint: Checkpoint = JSON.parse(checkpointData);
      this.checkpoints.set(executionId, checkpoint);

      const execution: Execution = {
        id: checkpoint.executionId,
        taskId: (checkpoint.data as { taskId: string }).taskId,
        agentId: (checkpoint.data as { agentId: string }).agentId,
        state: checkpoint.state,
        startedAt: new Date((checkpoint.data as { startedAt: string }).startedAt),
        completedAt: (checkpoint.data as { completedAt?: string }).completedAt 
          ? new Date((checkpoint.data as { completedAt: string }).completedAt)
          : undefined
      };

      auditTrail.log('FSIntegration', 'restoreExecution', 'success', { executionId });
      return execution;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('FSIntegration', 'restoreExecution', 'error', { executionId }, errorMsg);
      throw new Error(`Failed to restore execution: ${errorMsg}`);
    }
  }

  /**
   * Store execution logs in append-only log files
   */
  async storeExecutionLogs(executionId: string, logs: string[]): Promise<void> {
    try {
      const logPath = `/var/clawfs/logs/executions/${executionId}.log`;
      
      // Append logs
      const logContent = logs.map(log => 
        `[${new Date().toISOString()}] ${log}`
      ).join('\n') + '\n';

      await this.appendToClawFS(logPath, logContent);

      // Update in-memory cache
      const existing = this.logStreams.get(executionId) || [];
      this.logStreams.set(executionId, [...existing, ...logs]);

      auditTrail.log('FSIntegration', 'storeExecutionLogs', 'success', { 
        executionId,
        logCount: logs.length 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('FSIntegration', 'storeExecutionLogs', 'error', { executionId }, errorMsg);
      throw new Error(`Failed to store execution logs: ${errorMsg}`);
    }
  }

  /**
   * Get execution artifacts (output files)
   */
  async getExecutionArtifacts(executionId: string): Promise<string[]> {
    try {
      const artifactsPath = `/var/clawfs/artifacts/${executionId}`;
      const artifacts = await this.listClawFSDirectory(artifactsPath);

      auditTrail.log('FSIntegration', 'getExecutionArtifacts', 'success', { 
        executionId,
        artifactCount: artifacts.length 
      });

      return artifacts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('FSIntegration', 'getExecutionArtifacts', 'error', { executionId }, errorMsg);
      throw new Error(`Failed to get execution artifacts: ${errorMsg}`);
    }
  }

  // Private helper methods
  private async writeToClawFS(path: string, data: string): Promise<void> {
    // Simulate write to ClawFS
    return Promise.resolve();
  }

  private async readFromClawFS(path: string): Promise<string | null> {
    // Simulate read from ClawFS
    return Promise.resolve(null);
  }

  private async appendToClawFS(path: string, data: string): Promise<void> {
    // Simulate append to ClawFS
    return Promise.resolve();
  }

  private async listClawFSDirectory(path: string): Promise<string[]> {
    // Simulate directory listing from ClawFS
    return Promise.resolve([]);
  }
}

// ============================================================================
// 4. ClawSchedulerTAPIntegration
// ============================================================================

/**
 * TAP (Trust and Payment) Integration for ClawScheduler
 * Handles reputation, escrow, and penalties
 */
export class ClawSchedulerTAPIntegration {
  private agentReputations: Map<string, AgentReputation> = new Map();
  private escrowAccounts: Map<string, EscrowAccount> = new Map();

  /**
   * Verify agent has required capability (check reputation)
   */
  async verifyAgentCapability(agentId: string, requiredCapability: string): Promise<boolean> {
    try {
      const reputation = await this.getAgentReputation(agentId);
      
      if (!reputation) {
        auditTrail.log('TAPIntegration', 'verifyAgentCapability', 'error', { 
          agentId,
          requiredCapability 
        }, 'Agent not found');
        return false;
      }

      const hasCapability = reputation.capabilities.includes(requiredCapability);
      const sufficientScore = reputation.score >= 0.5; // Minimum reputation threshold

      const result = hasCapability && sufficientScore;

      auditTrail.log('TAPIntegration', 'verifyAgentCapability', result ? 'success' : 'error', {
        agentId,
        requiredCapability,
        hasCapability,
        score: reputation.score,
        result
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('TAPIntegration', 'verifyAgentCapability', 'error', { agentId, requiredCapability }, errorMsg);
      return false;
    }
  }

  /**
   * Record task completion for reputation tracking
   */
  async recordTaskCompletion(agentId: string, task: Task, result: TaskResult): Promise<void> {
    try {
      let reputation = await this.getAgentReputation(agentId);
      
      if (!reputation) {
        reputation = {
          agentId,
          score: 0.5,
          completedTasks: 0,
          failedTasks: 0,
          capabilities: []
        };
      }

      // Update reputation based on result
      if (result.success) {
        reputation.completedTasks++;
        reputation.score = Math.min(1.0, reputation.score + 0.01);
      } else {
        reputation.failedTasks++;
        reputation.score = Math.max(0.0, reputation.score - 0.05);
      }

      // Add capability if new task type
      if (!reputation.capabilities.includes(task.type)) {
        reputation.capabilities.push(task.type);
      }

      await this.setAgentReputation(agentId, reputation);

      auditTrail.log('TAPIntegration', 'recordTaskCompletion', 'success', {
        agentId,
        taskId: task.id,
        success: result.success,
        newScore: reputation.score
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('TAPIntegration', 'recordTaskCompletion', 'error', { agentId, taskId: task.id }, errorMsg);
      throw new Error(`Failed to record task completion: ${errorMsg}`);
    }
  }

  /**
   * Hold payment in escrow until task completion
   */
  async escrowPayment(task: Task): Promise<string> {
    try {
      if (!task.escrowAmount || task.escrowAmount <= 0n) {
        throw new Error('Task has no escrow amount');
      }

      const escrowId = `escrow-${task.id}-${Date.now()}`;
      
      const escrow: EscrowAccount = {
        id: escrowId,
        taskId: task.id,
        agentId: task.agentId,
        amount: task.escrowAmount,
        status: 'held',
        createdAt: new Date()
      };

      this.escrowAccounts.set(escrowId, escrow);

      // In production, this would interact with a blockchain or payment system
      await this.holdFunds(task.agentId, task.escrowAmount);

      auditTrail.log('TAPIntegration', 'escrowPayment', 'success', {
        escrowId,
        taskId: task.id,
        amount: task.escrowAmount.toString()
      });

      return escrowId;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('TAPIntegration', 'escrowPayment', 'error', { taskId: task.id }, errorMsg);
      throw new Error(`Failed to escrow payment: ${errorMsg}`);
    }
  }

  /**
   * Release payment on successful task completion
   */
  async releasePayment(task: Task, result: TaskResult): Promise<void> {
    try {
      if (!result.success) {
        throw new Error('Cannot release payment for failed task');
      }

      // Find escrow for this task
      const escrow = Array.from(this.escrowAccounts.values())
        .find(e => e.taskId === task.id);

      if (!escrow) {
        throw new Error(`No escrow found for task ${task.id}`);
      }

      if (escrow.status !== 'held') {
        throw new Error(`Escrow ${escrow.id} is not in held status`);
      }

      // Release funds to agent
      await this.releaseFunds(escrow.agentId, escrow.amount);
      escrow.status = 'released';
      escrow.releasedAt = new Date();

      auditTrail.log('TAPIntegration', 'releasePayment', 'success', {
        escrowId: escrow.id,
        taskId: task.id,
        amount: escrow.amount.toString(),
        agentId: escrow.agentId
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('TAPIntegration', 'releasePayment', 'error', { taskId: task.id }, errorMsg);
      throw new Error(`Failed to release payment: ${errorMsg}`);
    }
  }

  /**
   * Penalize agent on task failure (slash stake)
   */
  async penalizeFailure(agentId: string, task: Task): Promise<void> {
    try {
      // Find escrow for this task
      const escrow = Array.from(this.escrowAccounts.values())
        .find(e => e.taskId === task.id);

      let penaltyAmount = 0n;

      if (escrow && escrow.status === 'held') {
        // Slash a portion of the escrow
        penaltyAmount = escrow.amount / 10n; // 10% penalty
        escrow.status = 'slashed';
        escrow.penaltyAmount = penaltyAmount;
        escrow.slashedAt = new Date();

        await this.slashFunds(agentId, penaltyAmount);
      }

      // Also reduce reputation
      let reputation = await this.getAgentReputation(agentId);
      if (reputation) {
        reputation.score = Math.max(0.0, reputation.score - 0.1);
        await this.setAgentReputation(agentId, reputation);
      }

      auditTrail.log('TAPIntegration', 'penalizeFailure', 'success', {
        agentId,
        taskId: task.id,
        penaltyAmount: penaltyAmount.toString(),
        newScore: reputation?.score
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('TAPIntegration', 'penalizeFailure', 'error', { agentId, taskId: task.id }, errorMsg);
      throw new Error(`Failed to penalize failure: ${errorMsg}`);
    }
  }

  // Private helper methods
  private async getAgentReputation(agentId: string): Promise<AgentReputation | null> {
    return this.agentReputations.get(agentId) || null;
  }

  private async setAgentReputation(agentId: string, reputation: AgentReputation): Promise<void> {
    this.agentReputations.set(agentId, reputation);
  }

  private async holdFunds(agentId: string, amount: bigint): Promise<void> {
    // Simulate holding funds
    return Promise.resolve();
  }

  private async releaseFunds(agentId: string, amount: bigint): Promise<void> {
    // Simulate releasing funds
    return Promise.resolve();
  }

  private async slashFunds(agentId: string, amount: bigint): Promise<void> {
    // Simulate slashing funds
    return Promise.resolve();
  }
}

interface AgentReputation {
  agentId: string;
  score: number;
  completedTasks: number;
  failedTasks: number;
  capabilities: string[];
}

interface EscrowAccount {
  id: string;
  taskId: string;
  agentId: string;
  amount: bigint;
  status: 'held' | 'released' | 'slashed';
  createdAt: Date;
  releasedAt?: Date;
  slashedAt?: Date;
  penaltyAmount?: bigint;
}

// ============================================================================
// 5. Unified Export - ClawSchedulerIntegrations
// ============================================================================

/**
 * Unified integration class combining all ClawScheduler integrations
 */
export class ClawSchedulerIntegrations {
  public readonly bus: ClawSchedulerBusIntegration;
  public readonly kernel: ClawSchedulerKernelIntegration;
  public readonly fs: ClawSchedulerFSIntegration;
  public readonly tap: ClawSchedulerTAPIntegration;

  constructor() {
    this.bus = new ClawSchedulerBusIntegration();
    this.kernel = new ClawSchedulerKernelIntegration();
    this.fs = new ClawSchedulerFSIntegration();
    this.tap = new ClawSchedulerTAPIntegration();
  }

  /**
   * Initialize all integrations
   */
  async initialize(): Promise<void> {
    try {
      auditTrail.log('Integrations', 'initialize', 'success');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('Integrations', 'initialize', 'error', undefined, errorMsg);
      throw new Error(`Failed to initialize integrations: ${errorMsg}`);
    }
  }

  /**
   * Shutdown all integrations gracefully
   */
  async shutdown(): Promise<void> {
    try {
      auditTrail.log('Integrations', 'shutdown', 'success');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      auditTrail.log('Integrations', 'shutdown', 'error', undefined, errorMsg);
      throw new Error(`Failed to shutdown integrations: ${errorMsg}`);
    }
  }

  /**
   * Get audit logs for all integrations
   */
  getAuditLogs(): AuditLog[] {
    return auditTrail.getLogs();
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default ClawSchedulerIntegrations;
