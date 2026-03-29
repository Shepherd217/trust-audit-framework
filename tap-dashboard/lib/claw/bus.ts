/**
 * ============================================================================
 * ClawBus - Agent-to-Agent Messaging System for MoltOS
 * ============================================================================
 * 
 * A first-class messaging layer enabling agents to:
 * - Communicate peer-to-peer with typed messages
 * - Handoff tasks between agents (handshake protocol)
 * - Subscribe to pub/sub channels for broadcast communication
 * 
 * @module lib/claw/bus
 * @version 1.0.0
 * @reference Inspired by ZeroMQ's socket patterns and Erlang's actor model
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
export type MessageStatus = 'pending' | 'delivered' | 'read' | 'acknowledged' | 'failed';
export type HandoffStage = 'request' | 'accept' | 'transfer' | 'complete' | 'rejected';

export interface AgentIdentity {
  id: string;
  name: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
  lastSeen: Date;
  status: 'online' | 'away' | 'busy' | 'offline';
}

export interface MessageEnvelope<T = unknown> {
  id: string;
  version: '1.0';
  
  // Routing
  from: string;
  to: string;
  replyTo?: string;
  
  // Content
  type: string;
  payload: T;
  
  // Metadata
  priority: MessagePriority;
  ttl: number; // Time-to-live in seconds
  
  // Timestamps
  createdAt: Date;
  expiresAt?: Date;
  
  // Handoff context
  handoffId?: string;
  sessionContext?: Record<string, unknown>;
  
  // Delivery tracking
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface HandoffProtocol {
  id: string;
  stage: HandoffStage;
  fromAgent: string;
  toAgent: string;
  originalSessionId: string;
  payload: {
    context: Record<string, unknown>;
    state: Record<string, unknown>;
    reason: string;
    priority: MessagePriority;
  };
  initiatedAt: Date;
  completedAt?: Date;
}

export interface PubSubChannel {
  id: string;
  name: string;
  pattern: string;
  subscribers: string[];
  messageHistory: MessageEnvelope[];
  ttl: number;
  createdAt: Date;
}

export interface ChannelSubscription {
  channelPattern: string;
  agentId: string;
  handler: (message: MessageEnvelope) => void;
  subscribedAt: Date;
}

export interface MessageQuery {
  to?: string;
  from?: string;
  type?: string;
  status?: MessageStatus;
  since?: Date;
  until?: Date;
  handoffId?: string;
  replyTo?: string;
  limit?: number;
}

export interface DeliveryReceipt {
  messageId: string;
  status: MessageStatus;
  timestamp: Date;
  agentId: string;
}

export interface BusStats {
  totalMessages: number;
  pendingMessages: number;
  activeHandoffs: number;
  activeChannels: number;
  connectedAgents: number;
  avgDeliveryTimeMs: number;
}

// ============================================================================
// ERRORS
// ============================================================================

export class BusError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BusError';
  }
}

export class MessageTimeoutError extends BusError {
  constructor(messageId: string) {
    super(`Message ${messageId} timed out`, 'MESSAGE_TIMEOUT', { messageId });
    this.name = 'MessageTimeoutError';
  }
}

export class AgentOfflineError extends BusError {
  constructor(agentId: string) {
    super(`Agent ${agentId} is offline`, 'AGENT_OFFLINE', { agentId });
    this.name = 'AgentOfflineError';
  }
}

export class HandoffRejectedError extends BusError {
  constructor(handoffId: string, reason: string) {
    super(`Handoff ${handoffId} rejected: ${reason}`, 'HANDOFF_REJECTED', { handoffId, reason });
    this.name = 'HandoffRejectedError';
  }
}

// ============================================================================
// IN-MEMORY STORE (for WebSocket/active sessions)
// ============================================================================

interface InMemoryStore {
  agents: Map<string, AgentIdentity>;
  messages: Map<string, MessageEnvelope>;
  handoffs: Map<string, HandoffProtocol>;
  channels: Map<string, PubSubChannel>;
  subscriptions: Map<string, ChannelSubscription[]>;
  messageQueue: Map<string, MessageEnvelope[]>; // agentId -> messages
  webSockets: Map<string, WebSocket>;
}

const memoryStore: InMemoryStore = {
  agents: new Map(),
  messages: new Map(),
  handoffs: new Map(),
  channels: new Map(),
  subscriptions: new Map(),
  messageQueue: new Map(),
  webSockets: new Map(),
};

// ============================================================================
// CORE BUS CLASS
// ============================================================================

export interface BusConfig {
  supabase?: SupabaseClient;
  supabaseUrl?: string;
  supabaseKey?: string;
  enablePersistence?: boolean;
  maxMessageHistory?: number;
  defaultTTL?: number;
}

export class ClawBus {
  private supabase?: SupabaseClient;
  private enablePersistence: boolean;
  private maxMessageHistory: number;
  private defaultTTL: number;
  private localAgentId?: string;

  constructor(config: BusConfig = {}) {
    // Use shared Supabase client by default (production mode)
    this.supabase = config.supabase || supabase;
    this.enablePersistence = config.enablePersistence ?? true; // Default to persistence enabled
    this.maxMessageHistory = config.maxMessageHistory ?? 1000;
    this.defaultTTL = config.defaultTTL ?? 300; // 5 minutes default
  }

  /**
   * Register this bus instance with a local agent ID
   */
  registerAsAgent(agentId: string): void {
    this.localAgentId = agentId;
    this.updateAgentPresence(agentId, 'online');
  }

  /**
   * Get or create the singleton bus instance
   */
  static getInstance(config?: BusConfig): ClawBus {
    if (!globalThis.__clawBusInstance) {
      globalThis.__clawBusInstance = new ClawBus(config);
    }
    return globalThis.__clawBusInstance;
  }

  // ========================================================================
  // AGENT REGISTRY
  // ========================================================================

  /**
   * Register an agent in the bus
   */
  async registerAgent(identity: Omit<AgentIdentity, 'lastSeen'>): Promise<AgentIdentity> {
    const agent: AgentIdentity = {
      ...identity,
      lastSeen: new Date(),
    };

    memoryStore.agents.set(identity.id, agent);

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_agents').upsert({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        metadata: agent.metadata,
        status: agent.status,
        last_seen: agent.lastSeen.toISOString(),
      });
    }

    return agent;
  }

  /**
   * Update agent presence status
   */
  async updateAgentPresence(agentId: string, status: AgentIdentity['status']): Promise<void> {
    const agent = memoryStore.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastSeen = new Date();
    }

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_agents').update({
        status,
        last_seen: new Date().toISOString(),
      }).eq('id', agentId);
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentIdentity | undefined> {
    // Check memory first
    const cached = memoryStore.agents.get(agentId);
    if (cached && this.isRecent(cached.lastSeen)) {
      return cached;
    }

    // Fall back to persistence
    if (this.enablePersistence && this.supabase) {
      const { data } = await this.supabase
        .from('clawbus_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (data) {
        const agent: AgentIdentity = {
          id: data.id,
          name: data.name,
          capabilities: data.capabilities,
          metadata: data.metadata,
          status: data.status,
          lastSeen: data.last_seen ? new Date(data.last_seen) : new Date(),
        };
        memoryStore.agents.set(agentId, agent);
        return agent;
      }
    }

    return cached;
  }

  /**
   * List all online agents
   */
  async listOnlineAgents(): Promise<AgentIdentity[]> {
    return Array.from(memoryStore.agents.values()).filter(
      a => a.status === 'online' || a.status === 'away'
    );
  }

  /**
   * Find agents by capability
   */
  async findAgentsByCapability(capability: string): Promise<AgentIdentity[]> {
    return Array.from(memoryStore.agents.values()).filter(
      a => a.capabilities.includes(capability) && a.status !== 'offline'
    );
  }

  // ========================================================================
  // MESSAGE OPERATIONS
  // ========================================================================

  /**
   * Create a typed message envelope
   */
  createEnvelope<T>(
    from: string,
    to: string,
    type: string,
    payload: T,
    options: Partial<Omit<MessageEnvelope<T>, 'id' | 'version' | 'from' | 'to' | 'type' | 'payload' | 'createdAt' | 'status'>> = {}
  ): MessageEnvelope<T> {
    return {
      id: this.generateId(),
      version: '1.0',
      from,
      to,
      type,
      payload,
      priority: options.priority ?? 'normal',
      ttl: options.ttl ?? this.defaultTTL,
      createdAt: new Date(),
      expiresAt: options.ttl
        ? new Date(Date.now() + options.ttl * 1000)
        : undefined,
      replyTo: options.replyTo,
      handoffId: options.handoffId,
      sessionContext: options.sessionContext,
      status: 'pending',
    };
  }

  /**
   * Send a message to an agent
   */
  async send<T>(envelope: MessageEnvelope<T>): Promise<DeliveryReceipt> {
    // Store message
    memoryStore.messages.set(envelope.id, envelope as MessageEnvelope);

    // Add to recipient's queue
    const queue = memoryStore.messageQueue.get(envelope.to) || [];
    queue.push(envelope as MessageEnvelope);
    memoryStore.messageQueue.set(envelope.to, queue);

    // Check if recipient is online with WebSocket
    const ws = memoryStore.webSockets.get(envelope.to);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message',
        envelope: this.serializeEnvelope(envelope),
      }));
      envelope.status = 'delivered';
      envelope.deliveredAt = new Date();
    }

    // Persist if enabled
    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_messages').insert({
        id: envelope.id,
        version: envelope.version,
        from_agent: envelope.from,
        to_agent: envelope.to,
        message_type: envelope.type,
        payload: envelope.payload,
        priority: envelope.priority,
        ttl: envelope.ttl,
        created_at: envelope.createdAt.toISOString(),
        expires_at: envelope.expiresAt?.toISOString(),
        reply_to: envelope.replyTo,
        handoff_id: envelope.handoffId,
        session_context: envelope.sessionContext,
        status: envelope.status,
      });
    }

    // Emit to pub/sub if channel pattern matches
    this.broadcastToChannels(envelope as MessageEnvelope);

    return {
      messageId: envelope.id,
      status: envelope.status,
      timestamp: new Date(),
      agentId: envelope.to,
    };
  }

  /**
   * Send and wait for response
   */
  async sendAndWait<T, R>(
    envelope: MessageEnvelope<T>,
    timeoutMs: number = 30000
  ): Promise<MessageEnvelope<R>> {
    const receipt = await this.send(envelope);

    if (receipt.status === 'failed') {
      throw new BusError('Message failed to send', 'SEND_FAILED');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MessageTimeoutError(envelope.id));
      }, timeoutMs);

      // Store callback for when reply arrives
      const checkReply = setInterval(() => {
        const replies = this.poll(envelope.from, {
          replyTo: envelope.id,
          limit: 1,
        });

        if (replies.length > 0) {
          clearTimeout(timeout);
          clearInterval(checkReply);
          resolve(replies[0] as MessageEnvelope<R>);
        }
      }, 100);
    });
  }

  /**
   * Poll for messages (database-first with memory fallback)
   */
  async poll(agentId: string, query: MessageQuery = {}): Promise<MessageEnvelope[]> {
    // Try database first
    if (this.supabase) {
      let dbQuery = this.supabase
        .from('clawbus_messages')
        .select('*')
        .eq('to_agent', agentId)
        .order('created_at', { ascending: true });
      
      // Apply filters
      if (query.from) dbQuery = dbQuery.eq('from_agent', query.from);
      if (query.type) dbQuery = dbQuery.eq('message_type', query.type);
      if (query.status) dbQuery = dbQuery.eq('status', query.status);
      if (query.handoffId) dbQuery = dbQuery.eq('handoff_id', query.handoffId);
      if (query.limit) dbQuery = dbQuery.limit(query.limit);
      else dbQuery = dbQuery.limit(100);
      
      const { data, error } = await dbQuery;
      
      if (!error && data && data.length > 0) {
        // Mark fetched messages as delivered
        const messageIds = data.map(m => m.id);
        await this.supabase
          .from('clawbus_messages')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .in('id', messageIds)
          .eq('status', 'pending');
        
        return data.map(m => this.deserializeMessage(m));
      }
    }
    
    // Fallback to memory
    const queue = memoryStore.messageQueue.get(agentId) || [];
    
    let filtered = queue.filter(m => {
      if (query.from && m.from !== query.from) return false;
      if (query.type && m.type !== query.type) return false;
      if (query.status && m.status !== query.status) return false;
      if (query.handoffId && m.handoffId !== query.handoffId) return false;
      if (query.since && m.createdAt < query.since) return false;
      if (query.until && m.createdAt > query.until) return false;
      return true;
    });

    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    // Mark as read
    filtered.forEach(m => {
      if (m.status === 'delivered') {
        m.status = 'read';
        m.readAt = new Date();
      }
    });

    return filtered;
  }
  
  /**
   * Deserialize database message to envelope
   */
  private deserializeMessage(row: any): MessageEnvelope {
    return {
      id: row.message_id || row.id,
      version: row.version || '1.0',
      from: row.from_agent,
      to: row.to_agent,
      type: row.message_type,
      payload: row.payload,
      priority: row.priority,
      ttl: row.ttl_seconds || 300,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      replyTo: row.reply_to,
      handoffId: row.handoff_id,
      sessionContext: row.session_context,
      status: row.status,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      readAt: row.read_at ? new Date(row.read_at) : undefined,
    };
  }

  /**
   * Acknowledge message receipt
   */
  async acknowledge(messageId: string): Promise<void> {
    const message = memoryStore.messages.get(messageId);
    if (message) {
      message.status = 'acknowledged';
    }

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_messages').update({
        status: 'acknowledged',
      }).eq('id', messageId);
    }
  }

  /**
   * Acknowledge message receipt (alias for acknowledge)
   */
  async ack(messageId: string): Promise<void> {
    return this.acknowledge(messageId);
  }

  /**
   * Handoff task to another agent (simplified interface)
   */
  async handoff(body: {
    fromAgent: string;
    toAgent: string;
    context: Record<string, unknown>;
    reason?: string;
    priority?: MessagePriority;
  }): Promise<HandoffProtocol> {
    return this.initiateHandoff(
      body.fromAgent,
      body.toAgent,
      body.context,
      {
        reason: body.reason,
        priority: body.priority,
      }
    );
  }

  /**
   * Reply to a message
   */
  async reply<T>(
    originalMessage: MessageEnvelope,
    payload: T,
    type: string = 'reply'
  ): Promise<DeliveryReceipt> {
    const replyEnvelope = this.createEnvelope(
      originalMessage.to,
      originalMessage.from,
      type,
      payload,
      { replyTo: originalMessage.id }
    );

    return this.send(replyEnvelope);
  }

  // ========================================================================
  // HANDOFF PROTOCOL
  // ========================================================================

  /**
   * Initiate a handoff from one agent to another
   */
  async initiateHandoff(
    fromAgent: string,
    toAgent: string,
    context: Record<string, unknown>,
    options: {
      reason?: string;
      priority?: MessagePriority;
      sessionId?: string;
    } = {}
  ): Promise<HandoffProtocol> {
    // Check target agent is available
    const target = await this.getAgent(toAgent);
    if (!target || target.status === 'offline') {
      throw new AgentOfflineError(toAgent);
    }

    const handoff: HandoffProtocol = {
      id: this.generateId(),
      stage: 'request',
      fromAgent,
      toAgent,
      originalSessionId: options.sessionId || this.generateId(),
      payload: {
        context,
        state: {},
        reason: options.reason || 'Task handoff',
        priority: options.priority || 'normal',
      },
      initiatedAt: new Date(),
    };

    memoryStore.handoffs.set(handoff.id, handoff);

    // Send handoff request message
    const envelope = this.createEnvelope(fromAgent, toAgent, 'handoff:request', {
      handoffId: handoff.id,
      ...handoff.payload,
    }, {
      priority: options.priority || 'high',
      handoffId: handoff.id,
      sessionContext: context,
    });

    await this.send(envelope);

    // Persist
    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_handoffs').insert({
        id: handoff.id,
        stage: handoff.stage,
        from_agent: handoff.fromAgent,
        to_agent: handoff.toAgent,
        original_session_id: handoff.originalSessionId,
        payload: handoff.payload,
        initiated_at: handoff.initiatedAt.toISOString(),
      });
    }

    return handoff;
  }

  /**
   * Accept a handoff request
   */
  async acceptHandoff(handoffId: string): Promise<HandoffProtocol> {
    const handoff = memoryStore.handoffs.get(handoffId);
    if (!handoff) {
      throw new BusError('Handoff not found', 'HANDOFF_NOT_FOUND', { handoffId });
    }

    if (handoff.stage !== 'request') {
      throw new BusError('Handoff already processed', 'HANDOFF_INVALID_STATE', { 
        handoffId, 
        currentStage: handoff.stage 
      });
    }

    handoff.stage = 'accept';

    // Notify original agent
    const envelope = this.createEnvelope(
      handoff.toAgent,
      handoff.fromAgent,
      'handoff:accept',
      { handoffId, accepted: true }
    );
    await this.send(envelope);

    // Update in DB
    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_handoffs').update({
        stage: 'accept',
      }).eq('id', handoffId);
    }

    return handoff;
  }

  /**
   * Reject a handoff request
   */
  async rejectHandoff(handoffId: string, reason: string): Promise<HandoffProtocol> {
    const handoff = memoryStore.handoffs.get(handoffId);
    if (!handoff) {
      throw new BusError('Handoff not found', 'HANDOFF_NOT_FOUND', { handoffId });
    }

    handoff.stage = 'rejected';

    // Notify original agent
    const envelope = this.createEnvelope(
      handoff.toAgent,
      handoff.fromAgent,
      'handoff:reject',
      { handoffId, reason }
    );
    await this.send(envelope);

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_handoffs').update({
        stage: 'rejected',
      }).eq('id', handoffId);
    }

    return handoff;
  }

  /**
   * Transfer state during handoff
   */
  async transferHandoffState(
    handoffId: string,
    state: Record<string, unknown>
  ): Promise<HandoffProtocol> {
    const handoff = memoryStore.handoffs.get(handoffId);
    if (!handoff) {
      throw new BusError('Handoff not found', 'HANDOFF_NOT_FOUND', { handoffId });
    }

    handoff.stage = 'transfer';
    handoff.payload.state = state;

    // Send state to receiving agent
    const envelope = this.createEnvelope(
      handoff.fromAgent,
      handoff.toAgent,
      'handoff:state',
      { handoffId, state }
    );
    await this.send(envelope);

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_handoffs').update({
        stage: 'transfer',
        payload: handoff.payload,
      }).eq('id', handoffId);
    }

    return handoff;
  }

  /**
   * Complete a handoff
   */
  async completeHandoff(handoffId: string): Promise<HandoffProtocol> {
    const handoff = memoryStore.handoffs.get(handoffId);
    if (!handoff) {
      throw new BusError('Handoff not found', 'HANDOFF_NOT_FOUND', { handoffId });
    }

    handoff.stage = 'complete';
    handoff.completedAt = new Date();

    // Notify both parties
    const completeEnvelope = this.createEnvelope(
      handoff.toAgent,
      handoff.fromAgent,
      'handoff:complete',
      { handoffId, completed: true }
    );
    await this.send(completeEnvelope);

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_handoffs').update({
        stage: 'complete',
        completed_at: handoff.completedAt.toISOString(),
      }).eq('id', handoffId);
    }

    return handoff;
  }

  /**
   * Get handoff status
   */
  async getHandoff(handoffId: string): Promise<HandoffProtocol | undefined> {
    return memoryStore.handoffs.get(handoffId);
  }

  /**
   * List active handoffs for an agent
   */
  async listActiveHandoffs(agentId: string): Promise<HandoffProtocol[]> {
    return Array.from(memoryStore.handoffs.values()).filter(
      h => (h.fromAgent === agentId || h.toAgent === agentId) &&
           h.stage !== 'complete' &&
           h.stage !== 'rejected'
    );
  }

  // ========================================================================
  // PUB/SUB CHANNELS
  // ========================================================================

  /**
   * Create a pub/sub channel
   */
  async createChannel(name: string, pattern: string, ttl: number = 3600): Promise<PubSubChannel> {
    const channel: PubSubChannel = {
      id: this.generateId(),
      name,
      pattern,
      subscribers: [],
      messageHistory: [],
      ttl,
      createdAt: new Date(),
    };

    memoryStore.channels.set(channel.id, channel);
    memoryStore.subscriptions.set(pattern, []);

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_channels').insert({
        id: channel.id,
        name,
        pattern,
        ttl,
        created_at: channel.createdAt.toISOString(),
      });
    }

    return channel;
  }

  /**
   * Subscribe to a channel pattern
   */
  async subscribe(
    agentId: string,
    pattern: string,
    handler: (message: MessageEnvelope) => void
  ): Promise<void> {
    const subs = memoryStore.subscriptions.get(pattern) || [];
    subs.push({
      channelPattern: pattern,
      agentId,
      handler,
      subscribedAt: new Date(),
    });
    memoryStore.subscriptions.set(pattern, subs);

    // Add to channel subscribers
    for (const channel of memoryStore.channels.values()) {
      if (this.matchPattern(pattern, channel.pattern)) {
        if (!channel.subscribers.includes(agentId)) {
          channel.subscribers.push(agentId);
        }
      }
    }

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_subscriptions').insert({
        agent_id: agentId,
        pattern,
        subscribed_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(agentId: string, pattern: string): Promise<void> {
    const subs = memoryStore.subscriptions.get(pattern) || [];
    const filtered = subs.filter(s => s.agentId !== agentId);
    memoryStore.subscriptions.set(pattern, filtered);

    // Remove from channel subscribers
    for (const channel of memoryStore.channels.values()) {
      if (this.matchPattern(pattern, channel.pattern)) {
        channel.subscribers = channel.subscribers.filter(id => id !== agentId);
      }
    }

    if (this.enablePersistence && this.supabase) {
      await this.supabase.from('clawbus_subscriptions')
        .delete()
        .eq('agent_id', agentId)
        .eq('pattern', pattern);
    }
  }

  /**
   * Publish to a channel
   */
  async publish<T>(channelName: string, payload: T, from: string): Promise<DeliveryReceipt> {
    // Find channel
    let channel: PubSubChannel | undefined;
    for (const ch of memoryStore.channels.values()) {
      if (ch.name === channelName || this.matchPattern(channelName, ch.pattern)) {
        channel = ch;
        break;
      }
    }

    if (!channel) {
      // Auto-create channel
      channel = await this.createChannel(channelName, channelName);
    }

    // Create envelope
    const envelope = this.createEnvelope(from, `channel:${channelName}`, 'channel:message', payload);

    // Store in channel history
    channel.messageHistory.push(envelope);
    if (channel.messageHistory.length > this.maxMessageHistory) {
      channel.messageHistory.shift();
    }

    // Broadcast to subscribers
    this.broadcastToChannels(envelope);

    return {
      messageId: envelope.id,
      status: envelope.status,
      timestamp: new Date(),
      agentId: `channel:${channelName}`,
    };
  }

  /**
   * List available channels
   */
  listChannels(): PubSubChannel[] {
    return Array.from(memoryStore.channels.values());
  }

  /**
   * Get channel by name
   */
  getChannel(name: string): PubSubChannel | undefined {
    for (const channel of memoryStore.channels.values()) {
      if (channel.name === name) {
        return channel;
      }
    }
    return undefined;
  }

  // ========================================================================
  // WEBSOCKET MANAGEMENT
  // ========================================================================

  /**
   * Register a WebSocket connection for an agent
   */
  registerWebSocket(agentId: string, ws: WebSocket): void {
    memoryStore.webSockets.set(agentId, ws);
    this.updateAgentPresence(agentId, 'online');

    // Send any queued messages
    const queue = memoryStore.messageQueue.get(agentId) || [];
    for (const message of queue) {
      if (message.status === 'pending') {
        ws.send(JSON.stringify({
          type: 'message',
          envelope: this.serializeEnvelope(message),
        }));
        message.status = 'delivered';
        message.deliveredAt = new Date();
      }
    }

    ws.addEventListener('close', () => {
      this.unregisterWebSocket(agentId);
    });
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterWebSocket(agentId: string): void {
    memoryStore.webSockets.delete(agentId);
    this.updateAgentPresence(agentId, 'offline');
  }

  /**
   * Broadcast to all connected WebSockets
   */
  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of memoryStore.webSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  // ========================================================================
  // STATS & MONITORING
  // ========================================================================

  /**
   * Get bus statistics
   */
  getStats(): BusStats {
    const messages = Array.from(memoryStore.messages.values());
    const delivered = messages.filter(m => m.deliveredAt && m.createdAt);
    
    let totalDeliveryTime = 0;
    let deliveryCount = 0;
    
    for (const m of delivered) {
      if (m.deliveredAt && m.createdAt) {
        totalDeliveryTime += m.deliveredAt.getTime() - m.createdAt.getTime();
        deliveryCount++;
      }
    }

    return {
      totalMessages: messages.length,
      pendingMessages: messages.filter(m => m.status === 'pending').length,
      activeHandoffs: Array.from(memoryStore.handoffs.values()).filter(
        h => h.stage !== 'complete' && h.stage !== 'rejected'
      ).length,
      activeChannels: memoryStore.channels.size,
      connectedAgents: memoryStore.webSockets.size,
      avgDeliveryTimeMs: deliveryCount > 0 ? Math.round(totalDeliveryTime / deliveryCount) : 0,
    };
  }

  /**
   * Cleanup expired messages and channels
   */
  async cleanup(): Promise<void> {
    const now = new Date();

    // Clean expired messages
    for (const [id, message] of memoryStore.messages) {
      if (message.expiresAt && message.expiresAt < now) {
        memoryStore.messages.delete(id);
      }
    }

    // Clean expired channels
    for (const [id, channel] of memoryStore.channels) {
      const expiry = new Date(channel.createdAt.getTime() + channel.ttl * 1000);
      if (expiry < now && channel.subscribers.length === 0) {
        memoryStore.channels.delete(id);
      }
    }
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private generateId(): string {
    return `cb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private isRecent(date: Date, thresholdMs: number = 60000): boolean {
    return Date.now() - date.getTime() < thresholdMs;
  }

  private matchPattern(subscription: string, channel: string): boolean {
    // Simple glob matching: * matches anything
    const regex = new RegExp('^' + subscription.replace(/\*/g, '.*') + '$');
    return regex.test(channel);
  }

  private serializeEnvelope(envelope: MessageEnvelope): Record<string, unknown> {
    return {
      id: envelope.id,
      version: envelope.version,
      from: envelope.from,
      to: envelope.to,
      type: envelope.type,
      payload: envelope.payload,
      priority: envelope.priority,
      ttl: envelope.ttl,
      createdAt: envelope.createdAt.toISOString(),
      expiresAt: envelope.expiresAt?.toISOString(),
      replyTo: envelope.replyTo,
      handoffId: envelope.handoffId,
      sessionContext: envelope.sessionContext,
      status: envelope.status,
    };
  }

  private broadcastToChannels(envelope: MessageEnvelope): void {
    for (const [pattern, subs] of memoryStore.subscriptions) {
      if (this.matchPattern(pattern, envelope.to) || 
          (envelope.to.startsWith('channel:') && this.matchPattern(pattern, envelope.to.slice(8)))) {
        for (const sub of subs) {
          try {
            sub.handler(envelope);
          } catch (err) {
            console.error(`[ClawBus] Error in subscription handler:`, err);
          }
        }
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function getBus(config?: BusConfig): ClawBus {
  return ClawBus.getInstance(config);
}

/**
 * Get ClawBus service (alias for getBus)
 */
export function getClawBusService(config?: BusConfig): ClawBus {
  return getBus(config);
}

// ============================================================================
// TYPED MESSAGE BUILDERS
// ============================================================================

export const MessageBuilders = {
  /**
   * Create a task assignment message
   */
  task: <T>(from: string, to: string, task: T, options?: { priority?: MessagePriority; ttl?: number }) => {
    const bus = getBus();
    return bus.createEnvelope(from, to, 'task:assign', task, options);
  },

  /**
   * Create a status update message
   */
  status: (from: string, to: string, status: Record<string, unknown>) => {
    const bus = getBus();
    return bus.createEnvelope(from, to, 'status:update', status);
  },

  /**
   * Create a heartbeat message
   */
  heartbeat: (from: string) => {
    const bus = getBus();
    return bus.createEnvelope(from, 'broadcast', 'heartbeat', {
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Create an error message
   */
  error: (from: string, to: string, error: { code: string; message: string; details?: unknown }) => {
    const bus = getBus();
    return bus.createEnvelope(from, to, 'error', error, { priority: 'high' });
  },

  /**
   * Create a discovery message
   */
  discovery: (from: string, capabilities: string[]) => {
    const bus = getBus();
    return bus.createEnvelope(from, 'broadcast', 'discovery:announce', {
      capabilities,
      timestamp: new Date().toISOString(),
    });
  },
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
  ClawBus,
  getBus,
  MessageBuilders,
  BusError,
  MessageTimeoutError,
  AgentOfflineError,
  HandoffRejectedError,
};

// Global type declaration for singleton
declare global {
  var __clawBusInstance: ClawBus | undefined;
}
