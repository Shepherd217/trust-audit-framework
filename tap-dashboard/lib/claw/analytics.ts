/**
 * ClawAnalytics - Privacy-First Analytics for MoltOS
 * 
 * Core principles:
 *   - NO user identities or personal data
 *   - NO IP addresses or location tracking
 *   - Aggregate metrics only
 *   - Hashed identifiers for privacy
 * 
 * @module lib/claw/analytics
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANALYTICS_CONFIG = {
  // Data retention in days
  RETENTION_DAYS: 90,
  
  // Privacy pepper for hashing (should be from env in production)
  PEPPER: process.env.ANALYTICS_PEPPER || 'clawanalytics_pepper_2024',
  
  // Batch size for bulk operations
  BATCH_SIZE: 100,
  
  // Flush interval for batching (ms)
  FLUSH_INTERVAL: 5000,
  
  // Enable/disable tracking
  ENABLED: process.env.ANALYTICS_ENABLED !== 'false',
  
  // Debug mode
  DEBUG: process.env.ANALYTICS_DEBUG === 'true',
};

// ============================================================================
// TYPES
// ============================================================================

export type AnalyticsEventType = 
  | 'agent_deployed'
  | 'agent_updated'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'payment_sent'
  | 'payment_received'
  | 'payment_failed'
  | 'reputation_earned'
  | 'reputation_lost'
  | 'escrow_created'
  | 'escrow_funded'
  | 'escrow_completed'
  | 'escrow_disputed'
  | 'api_request'
  | 'sdk_event';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  agentId?: string;           // Will be hashed before storage
  sessionId?: string;         // Will be hashed before storage
  timestamp: Date;
  metricValue?: number;
  metricUnit?: string;
  metadata?: Record<string, any>; // Never contains PII
}

export interface AnalyticsBatch {
  events: AnalyticsEvent[];
  flushAt: number;
}

export interface DashboardMetrics {
  agents: {
    total: number;
    active24h: number;
    active7d: number;
    new24h: number;
  };
  tasks: {
    completed24h: number;
    completed7d: number;
    completed30d: number;
    failed24h: number;
    successRate24h: number;
  };
  payments: {
    volume24h: number;
    volume7d: number;
    count24h: number;
    averageTransaction24h: number;
  };
  reputation: {
    distribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  };
  timestamp: Date;
}

export interface TopAgent {
  agentHash: string;
  tasksCompleted: number;
  successRate: number;
  reputationScore: number;
  paymentsReceivedTotal: number;
  agentTier: 'elite' | 'expert' | 'established' | 'new';
  lastSeenAt: Date;
}

export interface ActivityFeedItem {
  id: string;
  eventType: AnalyticsEventType;
  agentHash?: string;
  metricValue?: number;
  metricUnit?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  timeAgo: string;
}

export interface DailyTrend {
  date: string;
  tasksCompleted: number;
  tasksFailed: number;
  paymentVolume: number;
  uniqueAgentsActive: number;
}

export interface ExportOptions {
  startDate: Date;
  endDate: Date;
  eventTypes?: AnalyticsEventType[];
  format: 'json' | 'csv' | 'ndjson';
  aggregateBy?: 'hour' | 'day' | 'week';
}

// ============================================================================
// PRIVACY-PRESERVING HASHING
// ============================================================================

/**
 * Hash an identifier for privacy preservation
 * Uses SHA-256 with a pepper for additional security
 * 
 * @param id - Raw identifier (agent ID, session ID, etc.)
 * @returns SHA-256 hex hash (64 characters)
 */
export function hashIdentifier(id: string): string {
  return crypto
    .createHash('sha256')
    .update(id + ANALYTICS_CONFIG.PEPPER)
    .digest('hex');
}

/**
 * Check if a string is a valid hash format
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

// ============================================================================
// ANALYTICS SERVICE CLASS
// ============================================================================

export class AnalyticsService {
  private supabase: ReturnType<typeof createTypedClient>;
  private batch: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isServer: boolean;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.isServer = typeof window === 'undefined';
    
    // Initialize Supabase client
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    this.supabase = createTypedClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Start flush timer if enabled
    if (ANALYTICS_CONFIG.ENABLED) {
      this.startFlushTimer();
    }
  }

  // ========================================================================
  // EVENT TRACKING
  // ========================================================================

  /**
   * Track a single analytics event
   * Events are batched for performance and flushed periodically
   */
  async track(event: AnalyticsEvent): Promise<void> {
    if (!ANALYTICS_CONFIG.ENABLED) {
      if (ANALYTICS_CONFIG.DEBUG) {
        console.error('[Analytics] Tracking disabled, skipping:', event.eventType);
      }
      return;
    }

    // Validate event type
    if (!this.isValidEventType(event.eventType)) {
      console.warn('[Analytics] Invalid event type:', event.eventType);
      return;
    }

    // Sanitize metadata to ensure no PII
    const sanitizedMetadata = this.sanitizeMetadata(event.metadata || {});

    // Add to batch
    this.batch.push({
      ...event,
      timestamp: event.timestamp || new Date(),
      metadata: sanitizedMetadata,
    });

    // Flush if batch is full
    if (this.batch.length >= ANALYTICS_CONFIG.BATCH_SIZE) {
      await this.flush();
    }

    if (ANALYTICS_CONFIG.DEBUG) {
      console.error('[Analytics] Tracked:', event.eventType);
    }
  }

  /**
   * Track agent deployment
   */
  async trackAgentDeploy(agentId: string, metadata?: Record<string, any>): Promise<void> {
    await this.track({
      eventType: 'agent_deployed',
      agentId,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        source: metadata?.source || 'api',
      },
    });
  }

  /**
   * Track task completion
   */
  async trackTaskCompleted(
    agentId: string, 
    taskDuration?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'task_completed',
      agentId,
      timestamp: new Date(),
      metricValue: taskDuration,
      metricUnit: 'seconds',
      metadata,
    });
  }

  /**
   * Track task failure
   */
  async trackTaskFailed(
    agentId: string,
    errorType?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'task_failed',
      agentId,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        errorType: errorType || 'unknown',
      },
    });
  }

  /**
   * Track payment received
   */
  async trackPaymentReceived(
    agentId: string,
    amount: number,
    currency: string = 'USD',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'payment_received',
      agentId,
      timestamp: new Date(),
      metricValue: amount,
      metricUnit: currency.toLowerCase(),
      metadata: {
        ...metadata,
        currency,
      },
    });
  }

  /**
   * Track payment sent
   */
  async trackPaymentSent(
    agentId: string,
    amount: number,
    currency: string = 'USD',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'payment_sent',
      agentId,
      timestamp: new Date(),
      metricValue: amount,
      metricUnit: currency.toLowerCase(),
      metadata: {
        ...metadata,
        currency,
      },
    });
  }

  /**
   * Track reputation change
   */
  async trackReputationChange(
    agentId: string,
    change: number,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: change > 0 ? 'reputation_earned' : 'reputation_lost',
      agentId,
      timestamp: new Date(),
      metricValue: Math.abs(change),
      metadata: {
        ...metadata,
        reason: reason || 'unspecified',
        direction: change > 0 ? 'positive' : 'negative',
      },
    });
  }

  /**
   * Track escrow event
   */
  async trackEscrow(
    eventType: 'escrow_created' | 'escrow_funded' | 'escrow_completed' | 'escrow_disputed',
    agentId: string,
    amount?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType,
      agentId,
      timestamp: new Date(),
      metricValue: amount,
      metricUnit: amount ? 'usd' : undefined,
      metadata,
    });
  }

  /**
   * Track API request
   */
  async trackApiRequest(
    agentId: string,
    endpoint: string,
    responseTime?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.track({
      eventType: 'api_request',
      agentId,
      timestamp: new Date(),
      metricValue: responseTime,
      metricUnit: responseTime ? 'ms' : undefined,
      metadata: {
        ...metadata,
        endpoint,
      },
    });
  }

  // ========================================================================
  // BATCH OPERATIONS
  // ========================================================================

  /**
   * Flush batched events to database
   */
  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const eventsToFlush = [...this.batch];
    this.batch = [];

    try {
      const records = eventsToFlush.map(event => ({
        event_type: event.eventType,
        agent_hash: event.agentId ? hashIdentifier(event.agentId) : null,
        session_hash: event.sessionId ? hashIdentifier(event.sessionId) : null,
        created_at: event.timestamp.toISOString(),
        metric_value: event.metricValue,
        metric_unit: event.metricUnit,
        metadata: event.metadata || {},
      }));

      const { error } = await this.supabase
        .from('analytics_events')
        .insert(records as any);

      if (error) {
        console.error('[Analytics] Flush error:', error);
        // Re-add events to batch for retry
        this.batch.unshift(...eventsToFlush);
      } else if (ANALYTICS_CONFIG.DEBUG) {
        console.error('[Analytics] Flushed', eventsToFlush.length, 'events');
      }
    } catch (error) {
      console.error('[Analytics] Flush exception:', error);
      // Re-add events to batch for retry
      this.batch.unshift(...eventsToFlush);
    }
  }

  /**
   * Force immediate flush of all pending events
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, ANALYTICS_CONFIG.FLUSH_INTERVAL);
  }

  /**
   * Stop the flush timer and flush remaining events
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  // ========================================================================
  // DASHBOARD QUERIES
  // ========================================================================

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Use RPC for efficient aggregation
    const { data: dashboardData, error: dashboardError } = await this.supabase
      .rpc('get_analytics_dashboard');

    if (dashboardError) {
      console.error('[Analytics] Dashboard query error:', dashboardError);
      // Fall back to individual queries
      return this.getDashboardMetricsFallback();
    }

    // Get reputation distribution
    const { data: repDistribution } = await this.supabase
      .from('analytics_reputation_distribution')
      .select('*');

    // Calculate success rate
    const { data: taskStats } = await this.supabase
      .from('analytics_events')
      .select('event_type')
      .in('event_type', ['task_completed', 'task_failed'])
      .gte('created_at', dayAgo.toISOString());

    const completed = (taskStats as any)?.filter((e: any) => e.event_type === 'task_completed').length || 0;
    const failed = (taskStats as any)?.filter((e: any) => e.event_type === 'task_failed').length || 0;
    const successRate = completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0;

    const data = dashboardData as any;
    return {
      agents: {
        total: data?.agents?.total || 0,
        active24h: data?.agents?.active_24h || 0,
        active7d: data?.agents?.active_7d || 0,
        new24h: data?.agents?.new_24h || 0,
      },
      tasks: {
        completed24h: data?.tasks?.completed_24h || 0,
        completed7d: data?.tasks?.completed_7d || 0,
        completed30d: data?.tasks?.completed_30d || 0,
        failed24h: data?.tasks?.failed_24h || 0,
        successRate24h: Math.round(successRate * 100) / 100,
      },
      payments: {
        volume24h: data?.payments?.volume_24h || 0,
        volume7d: 0, // Will be fetched separately if needed
        count24h: data?.payments?.count_24h || 0,
        averageTransaction24h: 0, // Calculated below
      },
      reputation: {
        distribution: repDistribution || [],
      },
      timestamp: now,
    };
  }

  private async getDashboardMetricsFallback(): Promise<DashboardMetrics> {
    // Fallback implementation using direct queries
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [{ count: totalAgents }, { data: recentEvents }, { data: repDist }] = await Promise.all([
      this.supabase.from('analytics_agents').select('*', { count: 'exact', head: true }),
      this.supabase
        .from('analytics_events')
        .select('event_type, metric_value')
        .gte('created_at', dayAgo.toISOString()),
      this.supabase.from('analytics_reputation_distribution').select('*'),
    ]);

    const tasksCompleted = (recentEvents as any)?.filter((e: any) => e.event_type === 'task_completed').length || 0;
    const tasksFailed = (recentEvents as any)?.filter((e: any) => e.event_type === 'task_failed').length || 0;
    const payments = (recentEvents as any)?.filter((e: any) => e.event_type === 'payment_received') || [];
    const paymentVolume = payments.reduce((sum: number, p: any) => sum + (p.metric_value || 0), 0);

    return {
      agents: {
        total: totalAgents || 0,
        active24h: 0,
        active7d: 0,
        new24h: 0,
      },
      tasks: {
        completed24h: tasksCompleted,
        completed7d: 0,
        completed30d: 0,
        failed24h: tasksFailed,
        successRate24h: tasksCompleted + tasksFailed > 0 
          ? Math.round((tasksCompleted / (tasksCompleted + tasksFailed)) * 10000) / 100 
          : 0,
      },
      payments: {
        volume24h: paymentVolume,
        volume7d: 0,
        count24h: payments.length,
        averageTransaction24h: payments.length > 0 ? paymentVolume / payments.length : 0,
      },
      reputation: {
        distribution: repDist || [],
      },
      timestamp: now,
    };
  }

  /**
   * Get top performing agents
   */
  async getTopAgents(limit: number = 20): Promise<TopAgent[]> {
    const { data, error } = await this.supabase
      .rpc('get_agent_leaderboard', { limit_count: limit } as any);

    if (error) {
      console.error('[Analytics] Top agents query error:', error);
      
      // Fallback to direct query
      const { data: agents, error: agentsError } = await this.supabase
        .from('analytics_agents')
        .select('*')
        .order('reputation_score', { ascending: false })
        .limit(limit);

      if (agentsError) throw agentsError;

      return (agents || []).map((a: any) => ({
        agentHash: a.agent_hash,
        tasksCompleted: a.tasks_completed,
        successRate: a.success_rate,
        reputationScore: a.reputation_score,
        paymentsReceivedTotal: a.payments_received_total,
        agentTier: this.calculateAgentTier(a.tasks_completed, a.success_rate),
        lastSeenAt: new Date(a.last_seen_at),
      }));
    }

    return ((data as any) || []).map((a: any) => ({
      agentHash: a.agent_hash,
      tasksCompleted: a.tasks_completed,
      successRate: a.success_rate,
      reputationScore: a.reputation_score,
      paymentsReceivedTotal: a.payments_received_total,
      agentTier: a.agent_tier as TopAgent['agentTier'],
      lastSeenAt: new Date(), // Not returned from RPC, would need to join
    }));
  }

  /**
   * Get real-time activity feed
   */
  async getActivityFeed(limit: number = 50): Promise<ActivityFeedItem[]> {
    const { data, error } = await this.supabase
      .from('analytics_activity_feed')
      .select('*')
      .limit(limit);

    if (error) {
      console.error('[Analytics] Activity feed error:', error);
      return [];
    }

    return ((data as any) || []).map((item: any) => ({
      id: item.id,
      eventType: item.event_type,
      agentHash: item.agent_hash,
      metricValue: item.metric_value,
      metricUnit: item.metric_unit,
      metadata: item.metadata || {},
      createdAt: new Date(item.created_at),
      timeAgo: item.time_ago,
    }));
  }

  /**
   * Get daily trends
   */
  async getDailyTrends(days: number = 30): Promise<DailyTrend[]> {
    const { data, error } = await this.supabase
      .from('analytics_daily_trends')
      .select('*')
      .limit(days);

    if (error) {
      console.error('[Analytics] Daily trends error:', error);
      return [];
    }

    return ((data as any) || []).map((t: any) => ({
      date: t.date,
      tasksCompleted: t.tasks_completed || 0,
      tasksFailed: t.tasks_failed || 0,
      paymentVolume: t.payment_volume || 0,
      uniqueAgentsActive: t.unique_agents_active || 0,
    }));
  }

  /**
   * Get hourly activity patterns for heatmaps
   */
  async getHourlyPatterns(): Promise<Array<{
    hourOfDay: number;
    dayOfWeek: number;
    eventCount: number;
    uniqueAgents: number;
  }>> {
    const { data, error } = await this.supabase
      .from('analytics_hourly_patterns')
      .select('*');

    if (error) {
      console.error('[Analytics] Hourly patterns error:', error);
      return [];
    }

    return ((data as any) || []).map((p: any) => ({
      hourOfDay: p.hour_of_day,
      dayOfWeek: p.day_of_week,
      eventCount: p.event_count,
      uniqueAgents: p.unique_agents,
    }));
  }

  // ========================================================================
  // EXPORT & REPORTING
  // ========================================================================

  /**
   * Export analytics data
   */
  async exportData(options: ExportOptions): Promise<{
    data: any[];
    format: string;
    recordCount: number;
  }> {
    let query = this.supabase
      .from('analytics_events')
      .select('*')
      .gte('created_at', options.startDate.toISOString())
      .lte('created_at', options.endDate.toISOString());

    if (options.eventTypes && options.eventTypes.length > 0) {
      query = query.in('event_type', options.eventTypes);
    }

    const { data, error } = await query;

    if (error) throw error;

    const records = data || [];

    // Format output based on requested format
    let formattedData: any[];
    switch (options.format) {
      case 'csv':
        formattedData = this.formatAsCSV(records);
        break;
      case 'ndjson':
        formattedData = records.map(r => JSON.stringify(r));
        break;
      case 'json':
      default:
        formattedData = records;
    }

    return {
      data: formattedData,
      format: options.format,
      recordCount: records.length,
    };
  }

  private formatAsCSV(records: any[]): string[] {
    if (records.length === 0) return [];
    
    const headers = Object.keys(records[0]).join(',');
    const rows = records.map(r => 
      Object.values(r).map(v => 
        typeof v === 'object' ? JSON.stringify(v) : String(v)
      ).join(',')
    );
    
    return [headers, ...rows];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private isValidEventType(type: string): type is AnalyticsEventType {
    const validTypes: AnalyticsEventType[] = [
      'agent_deployed', 'agent_updated', 'task_started', 'task_completed',
      'task_failed', 'task_cancelled', 'payment_sent', 'payment_received',
      'payment_failed', 'reputation_earned', 'reputation_lost',
      'escrow_created', 'escrow_funded', 'escrow_completed', 'escrow_disputed',
      'api_request', 'sdk_event'
    ];
    return validTypes.includes(type as AnalyticsEventType);
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const forbiddenKeys = [
      'email', 'username', 'name', 'firstName', 'lastName', 'fullName',
      'ip', 'ipAddress', 'userAgent', 'fingerprint', 'phone', 'address',
      'ssn', 'password', 'token', 'cookie', 'session', 'deviceId'
    ];

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // Skip forbidden keys
      if (forbiddenKeys.some(fk => key.toLowerCase().includes(fk.toLowerCase()))) {
        continue;
      }
      
      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private calculateAgentTier(
    tasksCompleted: number, 
    successRate: number
  ): TopAgent['agentTier'] {
    if (tasksCompleted > 100 && successRate > 95) return 'elite';
    if (tasksCompleted > 50 && successRate > 90) return 'expert';
    if (tasksCompleted > 10 && successRate > 80) return 'established';
    return 'new';
  }

  // ========================================================================
  // STATIC INSTANCE
  // ========================================================================

  private static instance: AnalyticsService | null = null;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  static resetInstance(): void {
    if (AnalyticsService.instance) {
      AnalyticsService.instance.destroy();
      AnalyticsService.instance = null;
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const analytics = AnalyticsService.getInstance();

export async function track(event: AnalyticsEvent): Promise<void> {
  return analytics.track(event);
}

export async function trackAgentDeploy(agentId: string, metadata?: Record<string, any>): Promise<void> {
  return analytics.trackAgentDeploy(agentId, metadata);
}

export async function trackTaskCompleted(
  agentId: string, 
  taskDuration?: number,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackTaskCompleted(agentId, taskDuration, metadata);
}

export async function trackTaskFailed(
  agentId: string,
  errorType?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackTaskFailed(agentId, errorType, metadata);
}

export async function trackPaymentReceived(
  agentId: string,
  amount: number,
  currency?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackPaymentReceived(agentId, amount, currency, metadata);
}

export async function trackPaymentSent(
  agentId: string,
  amount: number,
  currency?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackPaymentSent(agentId, amount, currency, metadata);
}

export async function trackReputationChange(
  agentId: string,
  change: number,
  reason?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackReputationChange(agentId, change, reason, metadata);
}

export async function trackEscrow(
  eventType: 'escrow_created' | 'escrow_funded' | 'escrow_completed' | 'escrow_disputed',
  agentId: string,
  amount?: number,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackEscrow(eventType, agentId, amount, metadata);
}

export async function trackApiRequest(
  agentId: string,
  endpoint: string,
  responseTime?: number,
  metadata?: Record<string, any>
): Promise<void> {
  return analytics.trackApiRequest(agentId, endpoint, responseTime, metadata);
}

export default analytics;
