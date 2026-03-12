/**
 * Agent Assignment System
 * 
 * Features:
 * - Skill-based matching with proficiency weighting
 * - Load balancing across agents
 * - Reputation-weighted selection
 * - Capacity-aware assignment
 * - Preferred/excluded agent support
 */

import { EventEmitter } from 'events';
import {
  Agent,
  AgentId,
  Task,
  TaskId,
  SchedulerConfig,
} from './types.ts';

/** Assignment result */
export interface AssignmentResult {
  agent: Agent;
  score: number;
  reasons: string[];
}

/** Agent pool management */
export class AgentPool extends EventEmitter {
  private agents = new Map<AgentId, Agent>();
  private taskAssignments = new Map<TaskId, AgentId>();
  private config: SchedulerConfig;
  private heartbeatInterval?: number;
  
  // Metrics
  private assignmentHistory: Array<{
    taskId: TaskId;
    agentId: AgentId;
    score: number;
    timestamp: Date;
  }> = [];
  
  constructor(config: SchedulerConfig) {
    super();
    this.config = config;
  }
  
  /** Initialize agent pool */
  async initialize(): Promise<void> {
    // Start heartbeat monitor
    this.startHeartbeatMonitor();
    this.emit('initialized');
  }
  
  /** Shutdown agent pool */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.emit('shutdown');
  }
  
  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================
  
  /** Register a new agent */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, {
      ...agent,
      lastHeartbeat: new Date(),
    });
    this.emit('agent:registered', { agentId: agent.id, name: agent.name });
  }
  
  /** Unregister an agent */
  unregisterAgent(agentId: AgentId): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      this.emit('agent:unregistered', { agentId, name: agent.name });
      return true;
    }
    return false;
  }
  
  /** Update agent information */
  updateAgent(agentId: AgentId, updates: Partial<Agent>): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, updates, { lastHeartbeat: new Date() });
      this.emit('agent:updated', { agentId, updates });
      return true;
    }
    return false;
  }
  
  /** Record agent heartbeat */
  heartbeat(agentId: AgentId): boolean {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
      if (agent.status === 'offline') {
        agent.status = 'online';
        this.emit('agent:online', { agentId });
      }
      return true;
    }
    return false;
  }
  
  /** Get agent by ID */
  getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }
  
  /** Get all agents */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  /** Get online agents */
  getOnlineAgents(): Agent[] {
    return this.getAllAgents().filter(a => a.status === 'online');
  }
  
  /** Get available agents (online with capacity) */
  getAvailableAgents(): Agent[] {
    return this.getAllAgents().filter(
      a => a.status === 'online' && a.currentLoad < a.capacity
    );
  }
  
  // ============================================================================
  // TASK ASSIGNMENT
  // ============================================================================
  
  /**
   * Find the best agent for a task
   * Uses multi-factor scoring:
   * - Skill match (40%)
   * - Load balance (25%)
   * - Reputation (20%)
   * - Performance (15%)
   */
  assignAgent(task: Task): AssignmentResult | null {
    const candidates = this.findCandidates(task);
    
    if (candidates.length === 0) {
      this.emit('assignment:failed', { taskId: task.id, reason: 'no_candidates' });
      return null;
    }
    
    // Score and rank candidates
    const scored = candidates.map(agent => this.scoreAgent(agent, task));
    scored.sort((a, b) => b.score - a.score);
    
    const best = scored[0];
    
    // Record assignment
    this.taskAssignments.set(task.id, best.agent.id);
    best.agent.currentLoad++;
    
    this.assignmentHistory.push({
      taskId: task.id,
      agentId: best.agent.id,
      score: best.score,
      timestamp: new Date(),
    });
    
    // Trim history if too large
    if (this.assignmentHistory.length > 10000) {
      this.assignmentHistory = this.assignmentHistory.slice(-5000);
    }
    
    this.emit('assignment:success', {
      taskId: task.id,
      agentId: best.agent.id,
      score: best.score,
    });
    
    return best;
  }
  
  /** Release agent from task */
  releaseAgent(taskId: TaskId, agentId: AgentId): boolean {
    const agent = this.agents.get(agentId);
    if (agent && agent.currentLoad > 0) {
      agent.currentLoad--;
      this.taskAssignments.delete(taskId);
      this.emit('agent:released', { taskId, agentId });
      return true;
    }
    return false;
  }
  
  /** Reassign a task to a different agent */
  reassignTask(task: Task, excludeAgentId: AgentId): AssignmentResult | null {
    // Remove current assignment
    this.taskAssignments.delete(task.id);
    
    // Create temporary exclusion
    const tempExcluded = [...(task.excludedAgents ?? []), excludeAgentId];
    const taskWithExclusion = { ...task, excludedAgents: tempExcluded };
    
    return this.assignAgent(taskWithExclusion);
  }
  
  /** Find candidate agents for a task */
  private findCandidates(task: Task): Agent[] {
    return this.getAvailableAgents().filter(agent => {
      // Check excluded agents
      if (task.excludedAgents?.includes(agent.id)) {
        return false;
      }
      
      // Check preferred agents - if specified, only consider those
      if (task.preferredAgents?.length > 0 && !task.preferredAgents.includes(agent.id)) {
        return false;
      }
      
      // Check required skills
      if (task.requiredSkills?.length > 0) {
        for (const skill of task.requiredSkills) {
          const proficiency = agent.skills.get(skill);
          if (!proficiency || proficiency < 0.3) {
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  /** Score an agent for a specific task */
  private scoreAgent(agent: Agent, task: Task): AssignmentResult {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Skill Match Score (0-40 points)
    const skillScore = this.calculateSkillScore(agent, task);
    score += skillScore * 40;
    if (skillScore > 0.8) reasons.push('excellent_skill_match');
    else if (skillScore > 0.5) reasons.push('good_skill_match');
    
    // 2. Load Balance Score (0-25 points)
    const loadScore = this.calculateLoadScore(agent);
    score += loadScore * 25;
    if (loadScore > 0.8) reasons.push('low_load');
    
    // 3. Reputation Score (0-20 points)
    score += agent.reputation * 20;
    if (agent.reputation > 0.9) reasons.push('high_reputation');
    
    // 4. Performance Score (0-15 points)
    const perfScore = this.calculatePerformanceScore(agent);
    score += perfScore * 15;
    if (perfScore > 0.9) reasons.push('excellent_performance');
    
    return { agent, score, reasons };
  }
  
  /** Calculate skill match score (0-1) */
  private calculateSkillScore(agent: Agent, task: Task): number {
    if (!task.requiredSkills || task.requiredSkills.length === 0) {
      return 1; // No skill requirements = perfect match
    }
    
    let totalScore = 0;
    for (const skill of task.requiredSkills) {
      const proficiency = agent.skills.get(skill) ?? 0;
      totalScore += proficiency;
    }
    
    return totalScore / task.requiredSkills.length;
  }
  
  /** Calculate load balance score (0-1) - lower load = higher score */
  private calculateLoadScore(agent: Agent): number {
    if (agent.capacity === 0) return 0;
    const utilization = agent.currentLoad / agent.capacity;
    return 1 - utilization;
  }
  
  /** Calculate performance score (0-1) */
  private calculatePerformanceScore(agent: Agent): number {
    const successWeight = 0.6;
    const speedWeight = 0.4;
    
    // Normalize execution time (assume 60s is average)
    const normalizedSpeed = Math.max(0, 1 - (agent.avgExecutionTime / 60000));
    
    return (agent.successRate * successWeight) + (normalizedSpeed * speedWeight);
  }
  
  // ============================================================================
  // AGENT STATS & REPUTATION
  // ============================================================================
  
  /** Update agent metrics after task completion */
  updateAgentMetrics(
    agentId: AgentId,
    result: { success: boolean; duration: number }
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    // Update success rate with exponential moving average
    const alpha = 0.1; // Smoothing factor
    agent.successRate = (agent.successRate * (1 - alpha)) + (result.success ? alpha : 0);
    
    // Update average execution time
    agent.avgExecutionTime = (agent.avgExecutionTime * 0.9) + (result.duration * 0.1);
    
    // Update reputation (composite score)
    agent.reputation = this.calculateReputation(agent);
    
    this.emit('agent:metrics_updated', {
      agentId,
      successRate: agent.successRate,
      avgExecutionTime: agent.avgExecutionTime,
      reputation: agent.reputation,
    });
  }
  
  /** Calculate agent reputation score */
  private calculateReputation(agent: Agent): number {
    const successWeight = 0.4;
    const consistencyWeight = 0.3;
    const availabilityWeight = 0.3;
    
    // Success rate component
    const successComponent = agent.successRate;
    
    // Consistency component (inverse of execution time variance)
    const consistencyComponent = Math.max(0, 1 - (agent.avgExecutionTime / 120000));
    
    // Availability component (based on current load)
    const availabilityComponent = 1 - (agent.currentLoad / agent.capacity);
    
    return (
      successComponent * successWeight +
      consistencyComponent * consistencyWeight +
      availabilityComponent * availabilityWeight
    );
  }
  
  /** Get agent statistics */
  getAgentStats(agentId: AgentId): {
    totalAssignments: number;
    averageScore: number;
    recentAssignments: number;
  } | null {
    const assignments = this.assignmentHistory.filter(a => a.agentId === agentId);
    if (assignments.length === 0) return null;
    
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    const recent = assignments.filter(a => a.timestamp > recentCutoff);
    
    const averageScore =
      assignments.reduce((sum, a) => sum + a.score, 0) / assignments.length;
    
    return {
      totalAssignments: assignments.length,
      averageScore,
      recentAssignments: recent.length,
    };
  }
  
  /** Get pool-wide statistics */
  getPoolStats(): {
    totalAgents: number;
    onlineAgents: number;
    availableAgents: number;
    totalCapacity: number;
    currentLoad: number;
    utilization: number;
  } {
    const all = this.getAllAgents();
    const online = this.getOnlineAgents();
    const available = this.getAvailableAgents();
    
    const totalCapacity = all.reduce((sum, a) => sum + a.capacity, 0);
    const currentLoad = all.reduce((sum, a) => sum + a.currentLoad, 0);
    
    return {
      totalAgents: all.length,
      onlineAgents: online.length,
      availableAgents: available.length,
      totalCapacity,
      currentLoad,
      utilization: totalCapacity > 0 ? currentLoad / totalCapacity : 0,
    };
  }
  
  // ============================================================================
  // LOAD BALANCING STRATEGIES
  // ============================================================================
  
  /** Balance load across agents */
  async rebalanceLoad(): Promise<void> {
    const stats = this.getPoolStats();
    
    // Check for imbalance
    if (stats.utilization > 0.8) {
      this.emit('load:high', {
        utilization: stats.utilization,
        message: 'High agent utilization detected',
      });
    }
    
    // Find overloaded agents
    const overloaded = this.getAllAgents().filter(
      a => a.currentLoad / a.capacity > 0.9
    );
    
    if (overloaded.length > 0) {
      this.emit('load:overloaded', {
        agents: overloaded.map(a => a.id),
        message: 'Some agents are overloaded',
      });
    }
  }
  
  /** Start heartbeat monitoring */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = this.config.agentTimeout || 30000;
      
      for (const agent of this.agents.values()) {
        const elapsed = now.getTime() - agent.lastHeartbeat.getTime();
        
        if (elapsed > timeout && agent.status !== 'offline') {
          agent.status = 'offline';
          this.emit('agent:offline', { agentId: agent.id, lastHeartbeat: agent.lastHeartbeat });
        }
      }
    }, 5000) as unknown as number;
  }
}

/** Factory function to create agent pool */
export async function createAgentPool(
  config: SchedulerConfig
): Promise<AgentPool> {
  const pool = new AgentPool(config);
  await pool.initialize();
  return pool;
}
