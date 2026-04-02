export const dynamic = 'force-dynamic';
/**
 * ============================================================================
 * ClawBus API Routes - Agent-to-Agent Messaging Endpoints
 * ============================================================================
 * 
 * Base: /api/claw/bus
 * 
 * Endpoints:
 * - GET    /api/claw/bus          → Health check + stats
 * - GET    /api/claw/bus/poll     → Poll for messages
 * - POST   /api/claw/bus/send     → Send a message
 * - POST   /api/claw/bus/handoff  → Handoff operations
 * - GET    /api/claw/bus/ws       → WebSocket upgrade endpoint
 * - POST   /api/claw/bus/channels → Channel operations
 * 
 * @module api/claw/bus
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBus, MessageBuilders } from '@/lib/claw/bus';

// Initialize bus instance
const bus = getBus({
  enablePersistence: true,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// ============================================================================
// GET /api/claw/bus
// Health check and bus statistics
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'poll':
        return handlePoll(request);
      case 'stats':
        return handleStats();
      case 'agents':
        return handleListAgents();
      case 'channels':
        return handleListChannels();
      default:
        // Default: return stats
        return handleStats();
    }
  } catch (error: any) {
    console.error('[ClawBus API] GET Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/claw/bus
// Handle various message operations
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    switch (action) {
      case 'send':
        return handleSend(body);
      case 'register':
        return handleRegister(body);
      case 'handoff':
        return handleHandoff(body);
      case 'subscribe':
        return handleSubscribe(body);
      case 'publish':
        return handlePublish(body);
      case 'acknowledge':
        return handleAcknowledge(body);
      default:
        return NextResponse.json(
          { error: 'Unknown action', code: 'UNKNOWN_ACTION' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[ClawBus API] POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function handlePoll(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const agentId = searchParams.get('agentId');
  const from = searchParams.get('from') || undefined;
  const type = searchParams.get('type') || undefined;
  const status = searchParams.get('status') as any || undefined;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!agentId) {
    return NextResponse.json(
      { error: 'agentId is required', code: 'MISSING_AGENT_ID' },
      { status: 400 }
    );
  }

  const messages = await bus.poll(agentId, {
    from,
    type,
    status,
    limit,
  });

  return NextResponse.json({
    success: true,
    agentId,
    messageCount: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      from: m.from,
      type: m.type,
      payload: m.payload,
      priority: m.priority,
      createdAt: m.createdAt.toISOString(),
      replyTo: m.replyTo,
      handoffId: m.handoffId,
    })),
  });
}

async function handleSend(body: any) {
  const { from, to, type, payload, priority, ttl, replyTo, sessionContext } = body;

  if (!from || !to || !type) {
    return NextResponse.json(
      { error: 'Missing required fields: from, to, type', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  const envelope = bus.createEnvelope(from, to, type, payload, {
    priority,
    ttl,
    replyTo,
    sessionContext,
  });

  const receipt = await bus.send(envelope);

  return NextResponse.json({
    success: true,
    messageId: receipt.messageId,
    status: receipt.status,
    timestamp: receipt.timestamp.toISOString(),
  });
}

async function handleRegister(body: any) {
  const { agentId, name, capabilities, metadata } = body;

  if (!agentId || !name) {
    return NextResponse.json(
      { error: 'Missing required fields: agentId, name', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  const agent = await bus.registerAgent({
    id: agentId,
    name,
    capabilities: capabilities || [],
    metadata: metadata || {},
    status: 'online',
  });

  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      status: agent.status,
      lastSeen: agent.lastSeen.toISOString(),
    },
  });
}

async function handleHandoff(body: any) {
  const { operation, ...params } = body;

  switch (operation) {
    case 'initiate': {
      const { fromAgent, toAgent, context, reason, priority, sessionId } = params;
      
      if (!fromAgent || !toAgent) {
        return NextResponse.json(
          { error: 'Missing fromAgent or toAgent', code: 'MISSING_FIELDS' },
          { status: 400 }
        );
      }

      const handoff = await bus.initiateHandoff(fromAgent, toAgent, context || {}, {
        reason,
        priority,
        sessionId,
      });

      return NextResponse.json({
        success: true,
        handoffId: handoff.id,
        stage: handoff.stage,
        fromAgent: handoff.fromAgent,
        toAgent: handoff.toAgent,
        initiatedAt: handoff.initiatedAt.toISOString(),
      });
    }

    case 'accept': {
      const { handoffId } = params;
      const handoff = await bus.acceptHandoff(handoffId);
      return NextResponse.json({
        success: true,
        handoffId: handoff.id,
        stage: handoff.stage,
      });
    }

    case 'reject': {
      const { handoffId, reason } = params;
      const handoff = await bus.rejectHandoff(handoffId, reason);
      return NextResponse.json({
        success: true,
        handoffId: handoff.id,
        stage: handoff.stage,
      });
    }

    case 'transfer': {
      const { handoffId, state } = params;
      const handoff = await bus.transferHandoffState(handoffId, state || {});
      return NextResponse.json({
        success: true,
        handoffId: handoff.id,
        stage: handoff.stage,
      });
    }

    case 'complete': {
      const { handoffId } = params;
      const handoff = await bus.completeHandoff(handoffId);
      return NextResponse.json({
        success: true,
        handoffId: handoff.id,
        stage: handoff.stage,
        completedAt: handoff.completedAt?.toISOString(),
      });
    }

    default:
      return NextResponse.json(
        { error: 'Unknown handoff operation', code: 'UNKNOWN_OPERATION' },
        { status: 400 }
      );
  }
}

async function handleSubscribe(body: any) {
  const { agentId, pattern, operation = 'subscribe' } = body;

  if (!agentId || !pattern) {
    return NextResponse.json(
      { error: 'Missing agentId or pattern', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  if (operation === 'unsubscribe') {
    await bus.unsubscribe(agentId, pattern);
    return NextResponse.json({
      success: true,
      operation: 'unsubscribe',
      agentId,
      pattern,
    });
  }

  // For HTTP, we can't register real-time handlers, so just track subscription
  await bus.subscribe(agentId, pattern, (msg) => {
    // Handler is a no-op for HTTP - WebSocket handles real delivery
    console.error(`[ClawBus] Subscription message for ${agentId}:`, msg.id);
  });

  return NextResponse.json({
    success: true,
    operation: 'subscribe',
    agentId,
    pattern,
  });
}

async function handlePublish(body: any) {
  const { channel, payload, from } = body;

  if (!channel || !from) {
    return NextResponse.json(
      { error: 'Missing channel or from', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  const receipt = await bus.publish(channel, payload, from);

  return NextResponse.json({
    success: true,
    messageId: receipt.messageId,
    channel,
    timestamp: receipt.timestamp.toISOString(),
  });
}

async function handleAcknowledge(body: any) {
  const { messageId } = body;

  if (!messageId) {
    return NextResponse.json(
      { error: 'Missing messageId', code: 'MISSING_FIELDS' },
      { status: 400 }
    );
  }

  await bus.acknowledge(messageId);

  return NextResponse.json({
    success: true,
    messageId,
    acknowledged: true,
  });
}

async function handleStats() {
  const stats = bus.getStats();

  return NextResponse.json({
    success: true,
    service: 'ClawBus',
    version: '1.0.0',
    stats: {
      ...stats,
    },
  });
}

async function handleListAgents() {
  const agents = await bus.listOnlineAgents();

  return NextResponse.json({
    success: true,
    agentCount: agents.length,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      capabilities: a.capabilities,
      status: a.status,
      lastSeen: a.lastSeen.toISOString(),
    })),
  });
}

async function handleListChannels() {
  const channels = bus.listChannels();

  return NextResponse.json({
    success: true,
    channelCount: channels.length,
    channels: channels.map(c => ({
      id: c.id,
      name: c.name,
      pattern: c.pattern,
      subscriberCount: c.subscribers.length,
      messageCount: c.messageHistory.length,
    })),
  });
}
