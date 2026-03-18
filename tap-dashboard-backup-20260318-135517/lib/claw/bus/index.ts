/**
 * ClawBus Core Service
 * Messaging system for MoltOS agents
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ClawMessage,
  HandoffContext,
  CreateClawMessageInput,
  ClawMessageRow,
} from './types';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

class ClawBusService {
  async send(input: CreateClawMessageInput): Promise<ClawMessage> {
    const message: ClawMessage = {
      id: uuidv4(),
      type: input.type,
      from: input.from,
      to: input.to,
      channel: input.channel,
      payload: input.payload,
      context: input.context ?? {
        conversationId: uuidv4(),
        trace: [input.from],
      },
      priority: input.priority ?? 3,
      ttl: input.ttl ?? 3600,
      createdAt: new Date(),
    };
    
    const row: ClawMessageRow = {
      id: message.id,
      type: message.type,
      from_agent: message.from,
      to_agent: message.to,
      channel: message.channel,
      payload: message.payload,
      context: message.context,
      priority: message.priority,
      ttl: message.ttl,
      created_at: message.createdAt.toISOString(),
    };
    
    const { error } = await getSupabase()
      .from('claw_messages')
      .insert(row);
    
    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
    
    return message;
  }
  
  async broadcast(channel: string, payload: any, from: string): Promise<void> {
    await this.send({
      type: 'broadcast',
      from,
      channel,
      payload,
      priority: 3,
      ttl: 3600,
    });
  }
  
  async handoff(context: HandoffContext): Promise<void> {
    const conversationId = uuidv4();
    
    await this.send({
      type: 'handoff',
      from: context.fromAgentId,
      to: context.toAgentId,
      payload: {
        taskContext: context.taskContext,
        handoff: true,
      },
      context: {
        conversationId,
        trace: [context.fromAgentId],
      },
      priority: 2, // High priority for handoffs
      ttl: 86400, // 24 hours
    });
    
    // Store conversation history as separate messages
    for (const msg of context.conversationHistory) {
      await this.send({
        type: 'event',
        from: msg.from,
        to: context.toAgentId,
        payload: { history: msg },
        context: {
          conversationId,
          parentMessageId: msg.id,
          trace: [...(msg.context?.trace ?? []), context.fromAgentId],
        },
        priority: 4, // Lower priority
        ttl: 86400,
      });
    }
  }
  
  async poll(agentId: string): Promise<ClawMessage[]> {
    const { data, error } = await getSupabase()
      .from('claw_messages')
      .select('*')
      .or(`to_agent.eq.${agentId},channel.eq.global`)
      .is('delivered_at', null)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to poll messages: ${error.message}`);
    }
    
    // Mark as delivered
    const ids = data?.map((row: ClawMessageRow) => row.id) ?? [];
    if (ids.length > 0) {
      await getSupabase()
        .from('claw_messages')
        .update({ delivered_at: new Date().toISOString() })
        .in('id', ids);
    }
    
    return (data ?? []).map(this.rowToMessage);
  }
  
  async acknowledge(messageId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('claw_messages')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', messageId);
    
    if (error) {
      throw new Error(`Failed to acknowledge message: ${error.message}`);
    }
  }
  
  private rowToMessage(row: ClawMessageRow): ClawMessage {
    return {
      id: row.id,
      type: row.type as ClawMessage['type'],
      from: row.from_agent,
      to: row.to_agent,
      channel: row.channel,
      payload: row.payload,
      context: row.context,
      priority: row.priority as 1 | 2 | 3 | 4 | 5,
      ttl: row.ttl,
      createdAt: new Date(row.created_at),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
    };
  }
}

// Singleton instance
let instance: ClawBusService | null = null;

export function getClawBusService(): ClawBusService {
  if (!instance) {
    instance = new ClawBusService();
  }
  return instance;
}

// Export types
export * from './types';
