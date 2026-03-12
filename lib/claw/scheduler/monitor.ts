/**
 * Monitoring System for ClawScheduler
 * 
 * Features:
 * - Real-time progress tracking
 * - Bottleneck detection with severity classification
 * - Performance metrics collection
 * - Alert generation
 * - Time-series data storage
 */

import { EventEmitter } from 'events';
import { RedisClientType } from 'redis';
import {
  Task,
  TaskId,
  WorkflowId,
  TaskState,
  WorkflowExecution,
  SchedulerMetrics,
  Bottleneck,
  TaskStatus,
  Agent,
} from './types.ts';

/** Time-series metric point */
interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

/** Alert severity */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Alert definition */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, unknown>;
}

/** Monitoring configuration */
export interface MonitorConfig {
  enabled: boolean;
  metricsInterval: number;
  bottleneckThreshold: number;
  alertThresholds: {
    queueDepth: number;
    taskFailureRate: number;
    agentUtilization: number;
  };
  retentionPeriod: number; // seconds
}

/** Default monitor configuration */
export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  enabled: true,
  metricsInterval: 10000,
  bottleneckThreshold: 0.8,
  alertThresholds: {
    queueDepth: 1000,
    taskFailureRate: 0.2,
    agentUtilization: 0.9,
  },
  retentionPeriod: 86400, // 24 hours
};

/** Monitoring system */
export class SchedulerMonitor extends EventEmitter {
  private config: MonitorConfig;
  private redis?: RedisClientType;
  
  // State
  private currentMetrics: SchedulerMetrics;
  private alerts: Alert[] = [];
  private activeWorkflows = new Map<WorkflowId, WorkflowExecution>();
  private metricsHistory: SchedulerMetrics[] = [];
  private taskLatencies: number[] = [];
  
  // Intervals
  private metricsInterval?: number;
  private isRunning = false;
  
  constructor(config: Partial<MonitorConfig> = {}, redis?: RedisClientType) {
    super();
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
    this.redis = redis;
    this.currentMetrics = this.createEmptyMetrics();
  }
  
  /** Initialize monitoring */
  async initialize(): Promise<void> {
    if (!this.config.enabled) return;
    
    this.isRunning = true;
    this.startMetricsCollection();
    this.emit('initialized');
  }
  
  /** Shutdown monitoring */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.emit('shutdown');
  }
  
  // ============================================================================
  // WORKFLOW TRACKING
  // ============================================================================
  
  /** Track new workflow execution */
  trackWorkflow(execution: WorkflowExecution): void {
    this.activeWorkflows.set(execution.id, execution);
    this.emit('workflow:started', {
      workflowId: execution.workflowId,
      executionId: execution.id,
    });
  }
  
  /** Update workflow progress */
  updateWorkflowProgress(
    executionId: string,
    progress: number,
    taskStates: Map<TaskId, TaskState>
  ): void {
    const workflow = this.activeWorkflows.get(executionId);
    if (workflow) {
      workflow.progress = progress;
      workflow.taskStates = taskStates;
      
      this.emit('workflow:progress', {
        executionId,
        workflowId: workflow.workflowId,
        progress,
        completedTasks: Array.from(taskStates.values()).filter(
          t => t.status === 'completed'
        ).length,
        totalTasks: taskStates.size,
      });
    }
  }
  
  /** Complete workflow tracking */
  completeWorkflow(executionId: string): void {
    const workflow = this.activeWorkflows.get(executionId);
    if (workflow) {
      workflow.status = 'completed';
      workflow.completedAt = new Date();
      workflow.progress = 100;
      
      this.emit('workflow:completed', {
        executionId,
        workflowId: workflow.workflowId,
        duration: workflow.completedAt.getTime() - workflow.startedAt.getTime(),
      });
      
      // Clean up after a delay
      setTimeout(() => {
        this.activeWorkflows.delete(executionId);
      }, 3600000); // Keep for 1 hour
    }
  }
  
  /** Get active workflow */
  getWorkflow(executionId: string): WorkflowExecution | undefined {
    return this.activeWorkflows.get(executionId);
  }
  
  /** Get all active workflows */
  getActiveWorkflows(): WorkflowExecution[] {
    return Array.from(this.activeWorkflows.values());
  }
  
  // ============================================================================
  // TASK TRACKING
  // ============================================================================
  
  /** Record task start */
  recordTaskStart(taskId: TaskId, executionId: string): void {
    this.currentMetrics.tasksRunning++;
    
    // Store start time for latency calculation
    if (this.redis) {
      this.redis.hSet('metrics:task_starts', taskId, Date.now().toString());
    }
  }
  
  /** Record task completion */
  recordTaskComplete(
    taskId: TaskId,
    executionId: string,
    duration: number,
    success: boolean
  ): void {
    this.currentMetrics.tasksRunning--;
    
    if (success) {
      this.currentMetrics.tasksCompleted++;
    } else {
      this.currentMetrics.tasksFailed++;
    }
    
    // Track latency
    this.taskLatencies.push(duration);
    if (this.taskLatencies.length > 1000) {
      this.taskLatencies = this.taskLatencies.slice(-500);
    }
    
    // Update average execution time
    this.currentMetrics.avgExecutionTime =
      this.taskLatencies.reduce((a, b) => a + b, 0) / this.taskLatencies.length;
    
    this.emit('task:complete', { taskId, executionId, duration, success });
  }
  
  /** Record queue time for a task */
  recordQueueTime(taskId: TaskId, queueTime: number): void {
    // Update running average
    const current = this.currentMetrics.avgQueueTime;
    this.currentMetrics.avgQueueTime = current * 0.9 + queueTime * 0.1;
  }
  
  // ============================================================================
  // BOTTLENECK DETECTION
  // ============================================================================
  
  /** Detect bottlenecks in the system */
  detectBottlenecks(
    queueDepth: number,
    agents: Agent[],
    taskStates: Map<TaskId, TaskState>[]
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Check for queue bottlenecks
    const queueBottleneck = this.detectQueueBottleneck(queueDepth);
    if (queueBottleneck) bottlenecks.push(queueBottleneck);
    
    // Check for agent bottlenecks
    const agentBottlenecks = this.detectAgentBottlenecks(agents);
    bottlenecks.push(...agentBottlenecks);
    
    // Check for dependency bottlenecks
    const dependencyBottlenecks = this.detectDependencyBottlenecks(taskStates);
    bottlenecks.push(...dependencyBottlenecks);
    
    // Update current metrics
    this.currentMetrics.bottlenecks = bottlenecks;
    
    // Emit alerts for high severity bottlenecks
    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'high' || bottleneck.severity === 'critical') {
        this.createAlert(
          'bottleneck',
          bottleneck.severity === 'critical' ? 'critical' : 'warning',
          `Bottleneck detected: ${bottleneck.description}`,
          bottleneck
        );
      }
    }
    
    return bottlenecks;
  }
  
  /** Detect queue-related bottlenecks */
  private detectQueueBottleneck(queueDepth: number): Bottleneck | null {
    const threshold = this.config.alertThresholds.queueDepth;
    
    if (queueDepth > threshold * 2) {
      return {
        type: 'queue',
        id: 'main_queue',
        severity: 'critical',
        description: `Queue depth (${queueDepth}) is critically high`,
        affectedTasks: [],
        recommendedAction: 'Scale up agents or reduce task submission rate',
      };
    } else if (queueDepth > threshold) {
      return {
        type: 'queue',
        id: 'main_queue',
        severity: 'high',
        description: `Queue depth (${queueDepth}) is above threshold`,
        affectedTasks: [],
        recommendedAction: 'Monitor and consider scaling if trend continues',
      };
    }
    
    return null;
  }
  
  /** Detect agent-related bottlenecks */
  private detectAgentBottlenecks(agents: Agent[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Check overall utilization
    const totalCapacity = agents.reduce((sum, a) => sum + a.capacity, 0);
    const currentLoad = agents.reduce((sum, a) => sum + a.currentLoad, 0);
    const utilization = totalCapacity > 0 ? currentLoad / totalCapacity : 0;
    
    if (utilization > this.config.alertThresholds.agentUtilization) {
      bottlenecks.push({
        type: 'agent',
        id: 'pool_utilization',
        severity: utilization > 0.95 ? 'critical' : 'high',
        description: `Agent pool utilization is ${(utilization * 100).toFixed(1)}%`,
        affectedTasks: [],
        recommendedAction: 'Add more agents or increase agent capacity',
      });
    }
    
    // Check individual agents
    for (const agent of agents) {
      const agentUtilization = agent.capacity > 0 ? agent.currentLoad / agent.capacity : 0;
      
      if (agentUtilization >= 1) {
        bottlenecks.push({
          type: 'agent',
          id: agent.id,
          severity: 'medium',
          description: `Agent ${agent.name} is at full capacity`,
          affectedTasks: [],
          recommendedAction: 'Redistribute tasks or increase agent capacity',
        });
      }
      
      // Check for slow agents (potential bottleneck)
      if (agent.avgExecutionTime > 60000) {
        bottlenecks.push({
          type: 'agent',
          id: agent.id,
          severity: 'low',
          description: `Agent ${agent.name} has high average execution time`,
          affectedTasks: [],
          recommendedAction: 'Investigate agent performance',
        });
      }
    }
    
    return bottlenecks;
  }
  
  /** Detect dependency-related bottlenecks */
  private detectDependencyBottlenecks(
    taskStates: Map<TaskId, TaskState>[]
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Find tasks that are blocking many other tasks
    const blockingCount = new Map<TaskId, number>();
    
    for (const stateMap of taskStates) {
      for (const [taskId, taskState] of stateMap) {
        if (taskState.status !== TaskStatus.COMPLETED) {
          // Count how many tasks depend on this one
          for (const [otherId, otherState] of stateMap) {
            if (otherState.task.dependencies.includes(taskId)) {
              blockingCount.set(taskId, (blockingCount.get(taskId) ?? 0) + 1);
            }
          }
        }
      }
    }
    
    // Report high-impact blocking tasks
    for (const [taskId, count] of blockingCount) {
      if (count > 5) {
        bottlenecks.push({
          type: 'task',
          id: taskId,
          severity: count > 10 ? 'high' : 'medium',
          description: `Task ${taskId} is blocking ${count} other tasks`,
          affectedTasks: Array.from(blockingCount.keys()),
          recommendedAction: 'Prioritize this task or investigate delays',
        });
      }
    }
    
    return bottlenecks;
  }
  
  // ============================================================================
  // METRICS COLLECTION
  // ============================================================================
  
  /** Get current metrics */
  getMetrics(): SchedulerMetrics {
    return { ...this.currentMetrics };
  }
  
  /** Get metrics history */
  getMetricsHistory(limit?: number): SchedulerMetrics[] {
    const history = [...this.metricsHistory];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }
  
  /** Update queue metrics */
  updateQueueMetrics(metrics: {
    queueDepth: number;
    tasksEnqueued: number;
    tasksDequeued: number;
  }): void {
    this.currentMetrics.queueDepth = metrics.queueDepth;
    this.currentMetrics.tasksEnqueued = metrics.tasksEnqueued;
    this.currentMetrics.tasksDequeued = metrics.tasksDequeued;
  }
  
  /** Update agent metrics */
  updateAgentMetrics(activeAgents: number, utilization: number): void {
    this.currentMetrics.activeAgents = activeAgents;
    this.currentMetrics.agentUtilization = utilization;
  }
  
  /** Calculate throughput (tasks per second) */
  calculateThroughput(timeWindowMs = 60000): number {
    const cutoff = Date.now() - timeWindowMs;
    const recent = this.metricsHistory.filter(m => {
      const timestamp = new Date().getTime(); // Use last update time
      return timestamp > cutoff;
    });
    
    if (recent.length < 2) return 0;
    
    const completedDelta =
      recent[recent.length - 1].tasksCompleted - recent[0].tasksCompleted;
    
    return completedDelta / (timeWindowMs / 1000);
  }
  
  // ============================================================================
  // ALERTS
  // ============================================================================
  
  /** Create a new alert */
  createAlert(
    category: string,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      category,
      message,
      timestamp: new Date(),
      acknowledged: false,
      metadata,
    };
    
    this.alerts.push(alert);
    
    // Trim old alerts
    const maxAge = this.config.retentionPeriod * 1000;
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(
      a => a.timestamp.getTime() > cutoff || !a.acknowledged
    );
    
    this.emit('alert', alert);
    return alert;
  }
  
  /** Get active (unacknowledged) alerts */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }
  
  /** Get all alerts */
  getAlerts(limit?: number): Alert[] {
    const sorted = [...this.alerts].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    if (limit) {
      return sorted.slice(0, limit);
    }
    return sorted;
  }
  
  /** Acknowledge an alert */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert:acknowledged', { alertId });
      return true;
    }
    return false;
  }
  
  /** Clear all alerts */
  clearAlerts(): void {
    this.alerts = [];
    this.emit('alerts:cleared');
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  /** Start metrics collection interval */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      // Update throughput
      this.currentMetrics.throughput = this.calculateThroughput();
      
      // Store history
      this.metricsHistory.push({ ...this.currentMetrics });
      
      // Trim history
      const maxHistory = 2880; // 8 hours at 10-second intervals
      if (this.metricsHistory.length > maxHistory) {
        this.metricsHistory = this.metricsHistory.slice(-maxHistory / 2);
      }
      
      // Persist to Redis if available
      if (this.redis) {
        this.persistMetrics();
      }
      
      this.emit('metrics:updated', this.currentMetrics);
    }, this.config.metricsInterval) as unknown as number;
  }
  
  /** Persist metrics to Redis */
  private async persistMetrics(): Promise<void> {
    if (!this.redis) return;
    
    const timestamp = Date.now();
    const metrics = JSON.stringify(this.currentMetrics);
    
    await this.redis.zAdd('metrics:history', [{
      score: timestamp,
      value: metrics,
    }]);
    
    // Trim old metrics
    const cutoff = Date.now() - this.config.retentionPeriod * 1000;
    await this.redis.zRemRangeByScore('metrics:history', 0, cutoff);
  }
  
  /** Create empty metrics object */
  private createEmptyMetrics(): SchedulerMetrics {
    return {
      queueDepth: 0,
      tasksEnqueued: 0,
      tasksDequeued: 0,
      tasksRunning: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      avgQueueTime: 0,
      avgExecutionTime: 0,
      throughput: 0,
      activeAgents: 0,
      agentUtilization: 0,
      bottlenecks: [],
    };
  }
}

/** Factory function to create monitor */
export async function createSchedulerMonitor(
  config?: Partial<MonitorConfig>,
  redis?: RedisClientType
): Promise<SchedulerMonitor> {
  const monitor = new SchedulerMonitor(config, redis);
  await monitor.initialize();
  return monitor;
}
