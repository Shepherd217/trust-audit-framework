/**
 * Bus Policy — ClawForge Integration for ClawBus
 * @module @exitliquidity/clawbus/bus-policy
 * 
 * ClawForge enforces moderation, rate limits, and governance on ClawBus.
 */

import { BusTopic, BusEvent, Subscription } from './clawbus';

// ============================================================================
// POLICY TYPES
// ============================================================================

export interface BusPolicy {
  topic: string;
  enabled: boolean;
  autoModeration: boolean;
  maxEventsPerMinute: number;
  maxPayloadSize: number;
  requireSignatures: boolean;
  encryptionRequired: boolean;
  suspiciousPatterns: string[];
  autoBlockThreshold: number; // violations before auto-block
}

export interface PolicyViolation {
  id: string;
  type: 'SPAM' | 'OVERSIZED_PAYLOAD' | 'RATE_LIMIT' | 'MALICIOUS_PATTERN' | 'REPUTATION_DROP';
  severity: 'low' | 'medium' | 'high' | 'critical';
  agentId: string;
  topic: string;
  eventId?: string;
  timestamp: number;
  details: string;
  autoAction?: 'warn' | 'throttle' | 'block_topic' | 'block_all' | 'queue_arbitra';
}

export interface ModerationAction {
  type: 'warn' | 'throttle' | 'block_from_topic' | 'block_from_bus' | 'queue_dispute';
  targetAgent: string;
  topic?: string;
  duration?: number; // ms
  reason: string;
}

// ============================================================================
// CLAWFORGE BUS POLICY ENFORCER
// ============================================================================

export class BusPolicyEnforcer {
  private policies: Map<string, BusPolicy> = new Map();
  private violations: Map<string, PolicyViolation[]> = new Map(); // agentId -> violations
  private actions: ModerationAction[] = [];
  private alerts: any[] = [];

  // --------------------------------------------------------------------------
  // POLICY MANAGEMENT
  // --------------------------------------------------------------------------

  setPolicy(policy: BusPolicy): void {
    this.policies.set(policy.topic, policy);
    console.log(`[ClawForge] Bus policy set for topic: ${policy.topic}`);
  }

  getPolicy(topic: string): BusPolicy | undefined {
    return this.policies.get(topic);
  }

  checkTopicPolicy(topic: BusTopic): { allowed: boolean; reason?: string } {
    // Check if topic name is allowed
    if (topic.name.startsWith('admin.') && !topic.allowedPublishers?.includes('system')) {
      return { allowed: false, reason: 'Reserved topic prefix' };
    }

    // Check thresholds are reasonable
    if (topic.publisherThreshold < 0 || topic.publisherThreshold > 100) {
      return { allowed: false, reason: 'Invalid publisher threshold' };
    }

    return { allowed: true };
  }

  // --------------------------------------------------------------------------
  // EVENT MONITORING
  // --------------------------------------------------------------------------

  async logBusEvent(event: BusEvent): Promise<void> {
    const policy = this.policies.get(event.topic);
    if (!policy || !policy.enabled) return;

    const violations: PolicyViolation[] = [];

    // Check payload size
    const payloadSize = JSON.stringify(event.payload).length;
    if (payloadSize > policy.maxPayloadSize) {
      violations.push({
        id: `viol-${Date.now()}-size`,
        type: 'OVERSIZED_PAYLOAD',
        severity: 'medium',
        agentId: event.publisher,
        topic: event.topic,
        eventId: event.id,
        timestamp: Date.now(),
        details: `Payload ${payloadSize} bytes exceeds max ${policy.maxPayloadSize}`,
        autoAction: 'throttle',
      });
    }

    // Check for suspicious patterns
    const payloadStr = JSON.stringify(event.payload);
    for (const pattern of policy.suspiciousPatterns) {
      if (payloadStr.includes(pattern)) {
        violations.push({
          id: `viol-${Date.now()}-pattern`,
          type: 'MALICIOUS_PATTERN',
          severity: 'high',
          agentId: event.publisher,
          topic: event.topic,
          eventId: event.id,
          timestamp: Date.now(),
          details: `Suspicious pattern detected: ${pattern}`,
          autoAction: 'block_topic',
        });
      }
    }

    // Check for spam (many events in short time)
    const agentViolations = this.violations.get(event.publisher) || [];
    const recentViolations = agentViolations.filter(v => 
      v.timestamp > Date.now() - 60000 && v.topic === event.topic
    );
    
    if (recentViolations.length > policy.autoBlockThreshold) {
      violations.push({
        id: `viol-${Date.now()}-spam`,
        type: 'SPAM',
        severity: 'high',
        agentId: event.publisher,
        topic: event.topic,
        eventId: event.id,
        timestamp: Date.now(),
        details: `Auto-block threshold reached: ${recentViolations.length} violations`,
        autoAction: 'block_topic',
      });
    }

    // Process violations
    for (const violation of violations) {
      await this.processViolation(violation);
    }
  }

  async logSubscription(subscription: Subscription): Promise<void> {
    console.log(`[ClawForge] Subscription logged: ${subscription.id}`);
    // Could enforce max subscriptions per agent here
  }

  // --------------------------------------------------------------------------
  // VIOLATION HANDLING
  // --------------------------------------------------------------------------

  private async processViolation(violation: PolicyViolation): Promise<void> {
    // Store violation
    if (!this.violations.has(violation.agentId)) {
      this.violations.set(violation.agentId, []);
    }
    this.violations.get(violation.agentId)!.push(violation);

    // Execute auto-action
    if (violation.autoAction) {
      const action = this.determineAction(violation);
      await this.executeAction(action);
    }

    // Create alert
    this.alerts.push({
      timestamp: Date.now(),
      severity: violation.severity,
      message: `${violation.type} by ${violation.agentId} on ${violation.topic}`,
    });
  }

  private determineAction(violation: PolicyViolation): ModerationAction {
    switch (violation.autoAction) {
      case 'warn':
        return {
          type: 'warn',
          targetAgent: violation.agentId,
          topic: violation.topic,
          reason: violation.details,
        };
      
      case 'throttle':
        return {
          type: 'throttle',
          targetAgent: violation.agentId,
          topic: violation.topic,
          duration: 60000, // 1 minute
          reason: violation.details,
        };
      
      case 'block_topic':
        return {
          type: 'block_from_topic',
          targetAgent: violation.agentId,
          topic: violation.topic,
          duration: 3600000, // 1 hour
          reason: violation.details,
        };
      
      case 'block_all':
        return {
          type: 'block_from_bus',
          targetAgent: violation.agentId,
          reason: violation.details,
        };
      
      case 'queue_arbitra':
        return {
          type: 'queue_dispute',
          targetAgent: violation.agentId,
          topic: violation.topic,
          reason: `Critical violation: ${violation.type}`,
        };
      
      default:
        return {
          type: 'warn',
          targetAgent: violation.agentId,
          reason: violation.details,
        };
    }
  }

  private async executeAction(action: ModerationAction): Promise<void> {
    this.actions.push(action);
    console.log(`[ClawForge] Moderation action: ${action.type} on ${action.targetAgent}`);

    switch (action.type) {
      case 'warn':
        // Send warning to agent
        break;
      
      case 'throttle':
        // Reduce rate limits
        break;
      
      case 'block_from_topic':
        // Block agent from specific topic
        break;
      
      case 'block_from_bus':
        // Block agent from all bus operations
        break;
      
      case 'queue_dispute':
        // Queue Arbitra dispute
        await this.queueArbitraDispute(action);
        break;
    }
  }

  private async queueArbitraDispute(action: ModerationAction): Promise<void> {
    console.log(`[ClawForge] Queuing Arbitra dispute for ${action.targetAgent}`);
    
    const violations = this.violations.get(action.targetAgent) || [];
    const evidence = {
      agentId: action.targetAgent,
      violations: violations.slice(-10), // Last 10 violations
      action: action,
    };

    // In production: submit to Arbitra contract
    console.log('  Evidence:', JSON.stringify(evidence, null, 2));
  }

  // --------------------------------------------------------------------------
  // MONITORING & ALERTS
  // --------------------------------------------------------------------------

  getViolations(agentId?: string): PolicyViolation[] {
    if (agentId) {
      return this.violations.get(agentId) || [];
    }
    return Array.from(this.violations.values()).flat();
  }

  getAlerts(severity?: string): any[] {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  getMetrics(): {
    totalPolicies: number;
    totalViolations: number;
    agentsBlocked: number;
    pendingDisputes: number;
  } {
    return {
      totalPolicies: this.policies.size,
      totalViolations: this.getViolations().length,
      agentsBlocked: this.actions.filter(a => a.type === 'block_from_bus').length,
      pendingDisputes: this.actions.filter(a => a.type === 'queue_dispute').length,
    };
  }

  // --------------------------------------------------------------------------
  // DASHBOARD INTEGRATION
  // --------------------------------------------------------------------------

  generateDashboardWidget(): any {
    const metrics = this.getMetrics();
    const recentAlerts = this.getAlerts().slice(-5);

    return {
      type: 'clawforge_bus_monitor',
      title: 'ClawBus Governance',
      metrics: {
        activePolicies: metrics.totalPolicies,
        violationsToday: metrics.totalViolations,
        blockedAgents: metrics.agentsBlocked,
        pendingDisputes: metrics.pendingDisputes,
      },
      recentAlerts,
      chart: {
        type: 'timeline',
        data: this.getViolationTimeline(),
      },
    };
  }

  private getViolationTimeline(): any[] {
    const timeline: Map<string, number> = new Map();
    
    for (const violation of this.getViolations()) {
      const hour = Math.floor(violation.timestamp / 3600000) * 3600000;
      const key = new Date(hour).toISOString();
      timeline.set(key, (timeline.get(key) || 0) + 1);
    }

    return Array.from(timeline.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, count]) => ({ time, count }));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BusPolicy, PolicyViolation, ModerationAction };
export default BusPolicyEnforcer;
