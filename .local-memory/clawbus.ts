/**
 * ClawBus — Real-Time Reputation-Weighted Event Bus / Pub-Sub
 * @version 0.1.0-alpha
 * @module @exitliquidity/clawbus
 * 
 * The real-time nervous system for ClawOS.
 * Provides reputation-gated publish/subscribe with ClawForge moderation.
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import { ClawID } from '../clawid-protocol/clawid-token';
import { TAPClient } from '../tap-sdk/tap-client';
import { ClawForgeControlPlane } from '../clawforge/control-plane';
import { ClawFS } from '../clawfs-protocol/clawfs';

// ============================================================================
// TYPES
// ============================================================================

export interface ClawBusConfig {
  agentId: string;
  clawId: ClawID;
  tapClient: TAPClient;
  clawForge?: ClawForgeControlPlane;
  clawFS?: ClawFS;
  maxEventSize?: number;       // bytes
  defaultRepThreshold?: number; // min reputation to pub/sub
  retentionMs?: number;        // how long to keep events
}

export interface BusTopic {
  name: string;
  publisherThreshold: number;  // min rep to publish
  subscriberThreshold: number; // min rep to subscribe
  rateLimitPerMinute: number;  // max events per agent
  requireSignature: boolean;
  encrypted: boolean;
  allowedPublishers?: string[]; // whitelist (optional)
  blockedAgents?: string[];     // blacklist
}

export interface BusEvent {
  id: string;
  topic: string;
  payload: any;
  publisher: string;           // ClawID
  timestamp: number;
  signature: string;
  reputation: number;          // at time of publish
  ttl?: number;                // optional expiration
}

export interface Subscription {
  id: string;
  topic: string;
  subscriber: string;          // ClawID
  callback: (event: BusEvent) => void | Promise<void>;
  filter?: (event: BusEvent) => boolean;
  maxEventsPerMinute?: number;
  priority: number;            // for callback ordering
}

export interface PublishResult {
  success: boolean;
  eventId?: string;
  error?: string;
  policyViolation?: string;
}

export interface SubscribeResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

export interface BusMetrics {
  totalTopics: number;
  totalEvents: number;
  activeSubscriptions: number;
  eventsPerSecond: number;
  topPublishers: { agentId: string; count: number }[];
  policyViolations: number;
}

// ============================================================================
// TOPIC REGISTRY
// ============================================================================

export class TopicRegistry {
  private topics: Map<string, BusTopic> = new Map();
  private clawForge?: ClawForgeControlPlane;

  constructor(clawForge?: ClawForgeControlPlane) {
    this.clawForge = clawForge;
  }

  registerTopic(topic: BusTopic): void {
    // Check with ClawForge before registering
    if (this.clawForge) {
      const check = this.clawForge.checkTopicPolicy(topic);
      if (!check.allowed) {
        throw new Error(`Topic policy rejected: ${check.reason}`);
      }
    }
    
    this.topics.set(topic.name, topic);
    console.log(`[ClawBus] Topic registered: ${topic.name}`);
  }

  getTopic(name: string): BusTopic | undefined {
    return this.topics.get(name);
  }

  canPublish(topicName: string, agentId: string, reputation: number): { allowed: boolean; reason?: string } {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return { allowed: false, reason: 'Topic not found' };
    }

    if (topic.blockedAgents?.includes(agentId)) {
      return { allowed: false, reason: 'Agent blocked from topic' };
    }

    if (topic.allowedPublishers && !topic.allowedPublishers.includes(agentId)) {
      return { allowed: false, reason: 'Not in publisher whitelist' };
    }

    if (reputation < topic.publisherThreshold) {
      return { allowed: false, reason: `Reputation ${reputation} below threshold ${topic.publisherThreshold}` };
    }

    return { allowed: true };
  }

  canSubscribe(topicName: string, agentId: string, reputation: number): { allowed: boolean; reason?: string } {
    const topic = this.topics.get(topicName);
    if (!topic) {
      return { allowed: false, reason: 'Topic not found' };
    }

    if (topic.blockedAgents?.includes(agentId)) {
      return { allowed: false, reason: 'Agent blocked from topic' };
    }

    if (reputation < topic.subscriberThreshold) {
      return { allowed: false, reason: `Reputation ${reputation} below threshold ${topic.subscriberThreshold}` };
    }

    return { allowed: true };
  }

  listTopics(): BusTopic[] {
    return Array.from(this.topics.values());
  }

  updateTopicPolicy(topicName: string, updates: Partial<BusTopic>): void {
    const topic = this.topics.get(topicName);
    if (topic) {
      Object.assign(topic, updates);
    }
  }
}

// ============================================================================
// EVENT STORE
// ============================================================================

export class EventStore {
  private events: Map<string, BusEvent[]> = new Map(); // topic -> events
  private clawFS?: ClawFS;
  private retentionMs: number;

  constructor(clawFS: ClawFS | undefined, retentionMs: number = 86400000) {
    this.clawFS = clawFS;
    this.retentionMs = retentionMs;
  }

  async store(event: BusEvent): Promise<void> {
    // Add to memory
    if (!this.events.has(event.topic)) {
      this.events.set(event.topic, []);
    }
    this.events.get(event.topic)!.push(event);

    // Persist to ClawFS for audit
    if (this.clawFS) {
      const path = `.clawbus/events/${event.topic}/${event.id}.json`;
      await this.clawFS.create(
        path,
        Buffer.from(JSON.stringify(event)),
        { tags: ['clawbus', 'event', event.topic] }
      );
    }

    // Cleanup old events
    this.cleanup(event.topic);
  }

  getEvents(topic: string, since?: number): BusEvent[] {
    const events = this.events.get(topic) || [];
    if (since) {
      return events.filter(e => e.timestamp > since);
    }
    return events;
  }

  getEvent(topic: string, eventId: string): BusEvent | undefined {
    const events = this.events.get(topic) || [];
    return events.find(e => e.id === eventId);
  }

  private cleanup(topic: string): void {
    const events = this.events.get(topic);
    if (!events) return;

    const cutoff = Date.now() - this.retentionMs;
    const filtered = events.filter(e => e.timestamp > cutoff);
    
    if (filtered.length !== events.length) {
      this.events.set(topic, filtered);
    }
  }

  async getAuditLog(topic: string, startTime: number, endTime: number): Promise<BusEvent[]> {
    // Retrieve from ClawFS for full audit
    if (this.clawFS) {
      // In production: query ClawFS for events in time range
    }
    
    const events = this.events.get(topic) || [];
    return events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

export class RateLimiter {
  private buckets: Map<string, { count: number; resetAt: number }> = new Map();

  checkLimit(key: string, limitPerMinute: number): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      // New bucket
      this.buckets.set(key, { count: 1, resetAt: now + 60000 });
      return { allowed: true };
    }

    if (bucket.count >= limitPerMinute) {
      return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }

    bucket.count++;
    return { allowed: true };
  }

  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return Infinity;
    return Math.max(0, bucket.count);
  }
}

// ============================================================================
// CORE CLAWBUS CLASS
// ============================================================================

export class ClawBus extends EventEmitter {
  private config: ClawBusConfig;
  private topics: TopicRegistry;
  private store: EventStore;
  private rateLimiter: RateLimiter;
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriberIndex: Map<string, Set<string>> = new Map(); // topic -> subscription IDs

  constructor(config: ClawBusConfig) {
    super();
    this.config = config;
    this.topics = new TopicRegistry(config.clawForge);
    this.store = new EventStore(config.clawFS, config.retentionMs);
    this.rateLimiter = new RateLimiter();
  }

  // --------------------------------------------------------------------------
  // TOPIC MANAGEMENT
  // --------------------------------------------------------------------------

  registerTopic(topic: BusTopic): void {
    this.topics.registerTopic(topic);
    this.emit('topic:registered', topic);
  }

  getTopic(name: string): BusTopic | undefined {
    return this.topics.getTopic(name);
  }

  // --------------------------------------------------------------------------
  // PUBLISH
  // --------------------------------------------------------------------------

  async publish(topicName: string, payload: any, options: { ttl?: number } = {}): Promise<PublishResult> {
    const agentId = this.config.agentId;
    
    // Step 1: Get reputation
    const reputation = await this.config.tapClient.getReputation(agentId);

    // Step 2: Check publish permission
    const permission = this.topics.canPublish(topicName, agentId, reputation);
    if (!permission.allowed) {
      return {
        success: false,
        error: permission.reason,
        policyViolation: 'PUBLISH_DENIED',
      };
    }

    // Step 3: Check rate limit
    const topic = this.topics.getTopic(topicName);
    if (topic) {
      const rateCheck = this.rateLimiter.checkLimit(`${agentId}:${topicName}`, topic.rateLimitPerMinute);
      if (!rateCheck.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded. Retry after ${rateCheck.retryAfter}s`,
          policyViolation: 'RATE_LIMIT',
        };
      }
    }

    // Step 4: Validate event size
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > (this.config.maxEventSize || 1048576)) {
      return {
        success: false,
        error: `Payload size ${payloadSize} exceeds max ${this.config.maxEventSize}`,
        policyViolation: 'SIZE_LIMIT',
      };
    }

    // Step 5: Create and sign event
    const eventId = this.generateEventId();
    const event: BusEvent = {
      id: eventId,
      topic: topicName,
      payload,
      publisher: agentId,
      timestamp: Date.now(),
      signature: '', // Will be filled
      reputation,
      ttl: options.ttl,
    };

    // Sign with ClawID
    if (topic?.requireSignature !== false) {
      event.signature = await this.config.clawId.sign(JSON.stringify({
        id: event.id,
        topic: event.topic,
        payload: event.payload,
        timestamp: event.timestamp,
      }));
    }

    // Step 6: Store event
    await this.store.store(event);

    // Step 7: Deliver to subscribers
    await this.deliverToSubscribers(event);

    // Step 8: Notify ClawForge
    if (this.config.clawForge) {
      await this.config.clawForge.logBusEvent(event);
    }

    this.emit('event:published', event);

    return {
      success: true,
      eventId,
    };
  }

  private async deliverToSubscribers(event: BusEvent): Promise<void> {
    const subIds = this.subscriberIndex.get(event.topic);
    if (!subIds) return;

    const promises: Promise<void>[] = [];

    for (const subId of subIds) {
      const sub = this.subscriptions.get(subId);
      if (!sub) continue;

      // Apply filter if present
      if (sub.filter && !sub.filter(event)) {
        continue;
      }

      // Check subscriber rate limit
      if (sub.maxEventsPerMinute) {
        const rateCheck = this.rateLimiter.checkLimit(`sub:${subId}`, sub.maxEventsPerMinute);
        if (!rateCheck.allowed) continue;
      }

      // Deliver
      promises.push(
        Promise.resolve().then(() => sub.callback(event)).catch(err => {
          console.error(`[ClawBus] Subscriber ${subId} callback error:`, err);
        })
      );
    }

    await Promise.all(promises);
  }

  private generateEventId(): string {
    return `evt-${createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .slice(0, 16)}-${Date.now()}`;
  }

  // --------------------------------------------------------------------------
  // SUBSCRIBE
  // --------------------------------------------------------------------------

  async subscribe(
    topicName: string,
    callback: (event: BusEvent) => void | Promise<void>,
    options: {
      filter?: (event: BusEvent) => boolean;
      maxEventsPerMinute?: number;
      priority?: number;
    } = {}
  ): Promise<SubscribeResult> {
    const agentId = this.config.agentId;

    // Step 1: Get reputation
    const reputation = await this.config.tapClient.getReputation(agentId);

    // Step 2: Check subscribe permission
    const permission = this.topics.canSubscribe(topicName, agentId, reputation);
    if (!permission.allowed) {
      return {
        success: false,
        error: permission.reason,
      };
    }

    // Step 3: Create subscription
    const subId = `sub-${agentId}-${topicName}-${Date.now()}`;
    const subscription: Subscription = {
      id: subId,
      topic: topicName,
      subscriber: agentId,
      callback,
      filter: options.filter,
      maxEventsPerMinute: options.maxEventsPerMinute,
      priority: options.priority || 0,
    };

    this.subscriptions.set(subId, subscription);

    // Add to subscriber index
    if (!this.subscriberIndex.has(topicName)) {
      this.subscriberIndex.set(topicName, new Set());
    }
    this.subscriberIndex.get(topicName)!.add(subId);

    // Step 4: Notify ClawForge
    if (this.config.clawForge) {
      await this.config.clawForge.logSubscription(subscription);
    }

    this.emit('subscription:created', subscription);

    return {
      success: true,
      subscriptionId: subId,
    };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;

    this.subscriptions.delete(subscriptionId);
    
    const index = this.subscriberIndex.get(sub.topic);
    if (index) {
      index.delete(subscriptionId);
    }

    this.emit('subscription:removed', { subscriptionId });
  }

  // --------------------------------------------------------------------------
  // QUERY & AUDIT
  // --------------------------------------------------------------------------

  getEvents(topic: string, since?: number): BusEvent[] {
    return this.store.getEvents(topic, since);
  }

  async getAuditLog(topic: string, startTime: number, endTime: number): Promise<BusEvent[]> {
    return this.store.getAuditLog(topic, startTime, endTime);
  }

  getMetrics(): BusMetrics {
    const topics = this.topics.listTopics();
    let totalEvents = 0;
    
    for (const topic of topics) {
      const events = this.store.getEvents(topic.name);
      totalEvents += events.length;
    }

    // Calculate events per second (simplified)
    const eventsPerSecond = totalEvents / 60; // rough estimate

    // Top publishers
    const publisherCounts: Map<string, number> = new Map();
    for (const topic of topics) {
      const events = this.store.getEvents(topic.name);
      for (const event of events) {
        const count = publisherCounts.get(event.publisher) || 0;
        publisherCounts.set(event.publisher, count + 1);
      }
    }

    const topPublishers = Array.from(publisherCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agentId, count]) => ({ agentId, count }));

    return {
      totalTopics: topics.length,
      totalEvents,
      activeSubscriptions: this.subscriptions.size,
      eventsPerSecond,
      topPublishers,
      policyViolations: 0, // Tracked by ClawForge
    };
  }

  // --------------------------------------------------------------------------
  // POLICY ENFORCEMENT
  // --------------------------------------------------------------------------

  async blockAgentFromTopic(agentId: string, topicName: string): Promise<void> {
    const topic = this.topics.getTopic(topicName);
    if (topic) {
      if (!topic.blockedAgents) topic.blockedAgents = [];
      topic.blockedAgents.push(agentId);
    }
    
    // Remove existing subscriptions
    for (const [subId, sub] of this.subscriptions) {
      if (sub.topic === topicName && sub.subscriber === agentId) {
        await this.unsubscribe(subId);
      }
    }

    this.emit('agent:blocked', { agentId, topic: topicName });
  }

  async pauseTopic(topicName: string): Promise<void> {
    this.emit('topic:paused', { topic: topicName });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawBus;
export { TopicRegistry, EventStore, RateLimiter };
export { BusTopic, BusEvent, Subscription, PublishResult, SubscribeResult };
