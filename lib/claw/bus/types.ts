/**
 * ============================================================================
 * ClawBus Types - Agent Messaging System Types for MoltOS
 * ============================================================================
 * 
 * Core type definitions for the ClawBus agent messaging system.
 * 
 * @module lib/claw/bus/types
 * @version 1.0.0
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageType = 'handoff' | 'request' | 'response' | 'broadcast' | 'event';

export type MessagePriority = 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest

export type MessageStatus = 
  | 'pending' 
  | 'delivered' 
  | 'read' 
  | 'acknowledged' 
  | 'failed'
  | 'expired';

export interface MessageContext {
  /** Unique conversation identifier */
  conversationId: string;
  /** Parent message ID for threaded conversations */
  parentMessageId?: string;
  /** Message chain/trace for debugging and tracking */
  trace: string[];
}

/**
 * Core ClawMessage interface - the fundamental unit of agent communication
 */
export interface ClawMessage<T = unknown> {
  /** Unique message identifier */
  id: string;
  /** Message type classification */
  type: MessageType;
  /** Sender agent ID */
  from: string;
  /** Target agent ID (undefined for broadcasts) */
  to?: string;
  /** Pub/sub channel name (for broadcast messages) */
  channel?: string;
  /** Message payload - type depends on message type */
  payload: T;
  /** Conversation context for tracking and handoffs */
  context?: MessageContext;
  /** Priority level (1 = highest, 5 = lowest) */
  priority: MessagePriority;
  /** Time-to-live in seconds */
  ttl: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp (calculated from ttl) */
  expiresAt?: Date;
  /** Current delivery status */
  status: MessageStatus;
  /** When the message was delivered */
  deliveredAt?: Date;
  /** When the message was read */
  readAt?: Date;
  /** When the message was acknowledged */
  acknowledgedAt?: Date;
  /** ID of message this is replying to */
  replyTo?: string;
  /** Handoff ID if this message is part of a handoff */
  handoffId?: string;
  /** Number of delivery attempts */
  attemptCount: number;
  /** Last delivery attempt timestamp */
  lastAttemptAt?: Date;
  /** Message version for schema evolution */
  version: string;
}

// ============================================================================
// HANDOFF PROTOCOL TYPES
// ============================================================================

export type HandoffStage = 
  | 'initiated' 
  | 'accepted' 
  | 'rejected' 
  | 'transferred' 
  | 'completed';

export interface HandoffContext {
  /** Conversation ID being handed off */
  conversationId: string;
  /** Full conversation history */
  history: ClawMessage[];
  /** Current state snapshot */
  state: Record<string, unknown>;
  /** Reason for handoff */
  reason: string;
  /** Original agent's notes */
  notes?: string;
}

export interface HandoffProtocol {
  /** Unique handoff identifier */
  id: string;
  /** Current stage in the handoff process */
  stage: HandoffStage;
  /** Source agent ID */
  fromAgent: string;
  /** Target agent ID */
  toAgent: string;
  /** Handoff context and state */
  context: HandoffContext;
  /** Priority level */
  priority: MessagePriority;
  /** When the handoff was initiated */
  initiatedAt: Date;
  /** When the handoff was accepted/rejected */
  respondedAt?: Date;
  /** When the handoff completed */
  completedAt?: Date;
  /** Rejection reason if rejected */
  rejectionReason?: string;
  /** Messages exchanged during handoff */
  messages: string[]; // message IDs
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentStatus = 'online' | 'away' | 'busy' | 'offline';

export interface AgentIdentity {
  /** Unique agent identifier */
  id: string;
  /** Human-readable agent name */
  name: string;
  /** Agent capabilities/skills */
  capabilities: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Current status */
  status: AgentStatus;
  /** Last seen timestamp */
  lastSeen: Date;
  /** When the agent registered */
  registeredAt: Date;
  /** Subscribed channels */
  subscriptions: string[];
}

export interface AgentRegistration {
  id: string;
  name: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CHANNEL TYPES
// ============================================================================

export interface PubSubChannel {
  /** Unique channel identifier */
  id: string;
  /** Channel name */
  name: string;
  /** Pattern for subscription matching (supports wildcards) */
  pattern: string;
  /** Subscribed agent IDs */
  subscribers: string[];
  /** Message history (limited) */
  messageHistory: ClawMessage[];
  /** Maximum messages to retain in history */
  maxHistorySize: number;
  /** Channel TTL in seconds */
  ttl: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Channel metadata */
  metadata: Record<string, unknown>;
}

export interface ChannelSubscription {
  /** Subscription ID */
  id: string;
  /** Channel pattern */
  pattern: string;
  /** Subscriber agent ID */
  agentId: string;
  /** When subscription was created */
  subscribedAt: Date;
  /** Subscription options */
  options?: {
    /** Only receive messages matching filter */
    filter?: Record<string, unknown>;
    /** Maximum messages per second */
    rateLimit?: number;
  };
}

// ============================================================================
// QUERY & FILTER TYPES
// ============================================================================

export interface MessageQuery {
  /** Filter by recipient */
  to?: string;
  /** Filter by sender */
  from?: string;
  /** Filter by message type */
  type?: MessageType;
  /** Filter by channel */
  channel?: string;
  /** Filter by status */
  status?: MessageStatus;
  /** Only messages after this time */
  since?: Date;
  /** Only messages before this time */
  until?: Date;
  /** Filter by handoff ID */
  handoffId?: string;
  /** Filter by conversation ID */
  conversationId?: string;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Minimum priority level */
  minPriority?: MessagePriority;
}

export interface PollOptions {
  /** Long-polling timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum messages to return */
  limit?: number;
  /** Auto-acknowledge returned messages */
  autoAck?: boolean;
}

// ============================================================================
// DELIVERY & RECEIPT TYPES
// ============================================================================

export interface DeliveryReceipt {
  /** Message ID */
  messageId: string;
  /** Delivery status */
  status: MessageStatus;
  /** Delivery timestamp */
  timestamp: Date;
  /** Recipient agent ID */
  to: string;
  /** Sender agent ID */
  from: string;
  /** Estimated delivery time (for queueing) */
  estimatedDelivery?: Date;
  /** Error message if failed */
  error?: string;
}

export interface BatchReceipt {
  /** Receipts for individual messages */
  receipts: DeliveryReceipt[];
  /** Total messages processed */
  total: number;
  /** Successfully delivered */
  succeeded: number;
  /** Failed deliveries */
  failed: number;
  /** Processing timestamp */
  timestamp: Date;
}

// ============================================================================
// BUS CONFIGURATION
// ============================================================================

export interface BusConfig {
  /** Supabase URL for persistence */
  supabaseUrl?: string;
  /** Supabase service key */
  supabaseKey?: string;
  /** Enable message persistence */
  enablePersistence?: boolean;
  /** Default message TTL in seconds */
  defaultTTL?: number;
  /** Maximum messages to keep in memory per agent */
  maxQueueSize?: number;
  /** Maximum channel history size */
  maxChannelHistory?: number;
  /** Enable deduplication */
  enableDeduplication?: boolean;
  /** Deduplication window in seconds */
  dedupWindowSeconds?: number;
  /** Poll interval for serverless fallback (ms) */
  pollIntervalMs?: number;
  /** Maximum messages per minute per agent */
  rateLimitPerAgent?: number;
}

export interface BusStats {
  /** Total messages processed */
  totalMessages: number;
  /** Messages currently pending delivery */
  pendingMessages: number;
  /** Failed message deliveries */
  failedMessages: number;
  /** Active handoffs in progress */
  activeHandoffs: number;
  /** Total completed handoffs */
  completedHandoffs: number;
  /** Active pub/sub channels */
  activeChannels: number;
  /** Currently online agents */
  onlineAgents: number;
  /** Total registered agents */
  totalAgents: number;
  /** Messages per minute (current) */
  messagesPerMinute: number;
  /** Average delivery time in ms */
  avgDeliveryTimeMs: number;
  /** Bus uptime in seconds */
  uptimeSeconds: number;
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  type: 'register' | 'message' | 'subscribe' | 'unsubscribe' | 'ack' | 'ping' | 'pong' | 'error';
  payload?: unknown;
  timestamp?: string;
}

export interface WebSocketRegistration {
  agentId: string;
  token?: string;
  capabilities?: string[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class BusError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'BusError';
  }
}

export class MessageTimeoutError extends BusError {
  constructor(messageId: string, timeoutMs: number) {
    super(
      `Message ${messageId} timed out after ${timeoutMs}ms`,
      'MESSAGE_TIMEOUT',
      { messageId, timeoutMs },
      true
    );
    this.name = 'MessageTimeoutError';
  }
}

export class AgentOfflineError extends BusError {
  constructor(agentId: string) {
    super(
      `Agent ${agentId} is offline or unreachable`,
      'AGENT_OFFLINE',
      { agentId },
      true
    );
    this.name = 'AgentOfflineError';
  }
}

export class HandoffRejectedError extends BusError {
  constructor(handoffId: string, reason: string) {
    super(
      `Handoff ${handoffId} was rejected: ${reason}`,
      'HANDOFF_REJECTED',
      { handoffId, reason },
      false
    );
    this.name = 'HandoffRejectedError';
  }
}

export class RateLimitError extends BusError {
  constructor(agentId: string, limit: number) {
    super(
      `Agent ${agentId} exceeded rate limit of ${limit} messages/minute`,
      'RATE_LIMIT_EXCEEDED',
      { agentId, limit },
      true
    );
    this.name = 'RateLimitError';
  }
}

export class DeduplicationError extends BusError {
  constructor(messageId: string) {
    super(
      `Message ${messageId} is a duplicate`,
      'DUPLICATE_MESSAGE',
      { messageId },
      false
    );
    this.name = 'DeduplicationError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type MessageHandler<T = unknown> = (message: ClawMessage<T>) => void | Promise<void>;

export type HandoffHandler = (handoff: HandoffProtocol) => void | Promise<void>;

export interface MessageBuilder<T = unknown> {
  type: MessageType;
  payload: T;
  priority?: MessagePriority;
  ttl?: number;
  channel?: string;
}

// ============================================================================
// SDK TYPES
// ============================================================================

export interface SDKSendOptions {
  to: string;
  message: string;
  type?: MessageType;
  priority?: MessagePriority;
  ttl?: number;
  channel?: string;
  contextFile?: string;
}

export interface SDKListenOptions {
  channel?: string;
  agentId?: string;
  timeout?: number;
  format?: 'json' | 'raw';
}

export interface SDKHandoffOptions {
  to: string;
  contextFile: string;
  reason?: string;
  priority?: MessagePriority;
}

// Export all types
export default {
  MessageType: ['handoff', 'request', 'response', 'broadcast', 'event'] as MessageType[],
  MessagePriority: [1, 2, 3, 4, 5] as MessagePriority[],
  MessageStatus: ['pending', 'delivered', 'read', 'acknowledged', 'failed', 'expired'] as MessageStatus[],
  HandoffStage: ['initiated', 'accepted', 'rejected', 'transferred', 'completed'] as HandoffStage[],
  AgentStatus: ['online', 'away', 'busy', 'offline'] as AgentStatus[],
};
