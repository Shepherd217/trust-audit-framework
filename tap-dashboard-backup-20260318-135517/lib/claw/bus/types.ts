/**
 * ClawBus Types
 * Core type definitions for the Agent Messaging System
 */

export interface ClawMessage {
  id: string;
  type: 'handoff' | 'request' | 'response' | 'broadcast' | 'event';
  from: string;
  to?: string;
  channel?: string;
  payload: any;
  context?: {
    conversationId: string;
    parentMessageId?: string;
    trace: string[];
  };
  priority: 1 | 2 | 3 | 4 | 5;
  ttl: number;
  createdAt: Date;
  deliveredAt?: Date;
}

export interface HandoffContext {
  fromAgentId: string;
  toAgentId: string;
  taskContext: any;
  conversationHistory: ClawMessage[];
}

export interface CreateClawMessageInput {
  type: ClawMessage['type'];
  from: string;
  to?: string;
  channel?: string;
  payload: any;
  context?: ClawMessage['context'];
  priority?: 1 | 2 | 3 | 4 | 5;
  ttl?: number;
}

// Database row type for Supabase
export interface ClawMessageRow {
  id: string;
  type: string;
  from_agent: string;
  to_agent?: string;
  channel?: string;
  payload: any;
  context?: any;
  priority: number;
  ttl: number;
  created_at: string;
  delivered_at?: string;
}
