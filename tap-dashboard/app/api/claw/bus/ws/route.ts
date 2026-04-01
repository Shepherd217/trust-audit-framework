/**
 * ============================================================================
 * ClawBus WebSocket Endpoint
 * ============================================================================
 * 
 * Route: /api/claw/bus/ws
 * Protocol: WebSocket for real-time agent communication
 * 
 * Messages:
 * - register: Register agent with WebSocket
 * - message: Incoming message from agent
 * - subscribe: Subscribe to channel
 * - unsubscribe: Unsubscribe from channel
 * - heartbeat: Keep connection alive
 * 
 * @module api/claw/bus/ws
 */

import { getBus } from '@/lib/claw/bus';

// Use edge runtime for WebSocket support
export const runtime = 'edge';

const bus = getBus({
  enablePersistence: true,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export async function GET(request: Request) {
  const upgrade = request.headers.get('upgrade');
  
  if (upgrade !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'Expected WebSocket upgrade', code: 'NO_UPGRADE' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // @ts-ignore - WebSocketPair is available in edge runtime
    const { 0: client, 1: server } = new WebSocketPair();

    handleWebSocket(server, request);

    return new Response(null, {
      status: 101,
      // @ts-ignore
      webSocket: client,
    });
  } catch (error: any) {
    console.error('[ClawBus WS] Error creating WebSocket:', error);
    return new Response(
      JSON.stringify({ error: error.message, code: 'WS_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function handleWebSocket(ws: WebSocket, request: Request) {
  let agentId: string | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  // Handle incoming messages
  ws.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'register':
          agentId = data.agentId;
          if (!agentId) {
            ws.send(JSON.stringify({ type: 'error', message: 'agentId is required' }));
            break;
          }
          bus.registerWebSocket(agentId, ws);
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'registered',
            agentId,
            timestamp: new Date().toISOString(),
          }));

          // Start heartbeat
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
          break;

        case 'message':
          if (!agentId) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'NOT_REGISTERED',
              message: 'Send register message first',
            }));
            return;
          }

          // Validate and send message
          const envelope = bus.createEnvelope(
            agentId,
            data.to,
            data.messageType || 'message',
            data.payload,
            {
              priority: data.priority,
              replyTo: data.replyTo,
            }
          );

          const receipt = await bus.send(envelope);
          
          ws.send(JSON.stringify({
            type: 'receipt',
            messageId: receipt.messageId,
            status: receipt.status,
          }));
          break;

        case 'subscribe':
          if (!agentId) {
            ws.send(JSON.stringify({
              type: 'error',
              code: 'NOT_REGISTERED',
              message: 'Send register message first',
            }));
            return;
          }

          await bus.subscribe(agentId, data.pattern, (msg) => {
            ws.send(JSON.stringify({
              type: 'channel:message',
              channel: data.pattern,
              envelope: {
                id: msg.id,
                from: msg.from,
                type: msg.type,
                payload: msg.payload,
                createdAt: msg.createdAt.toISOString(),
              },
            }));
          });

          ws.send(JSON.stringify({
            type: 'subscribed',
            pattern: data.pattern,
          }));
          break;

        case 'unsubscribe':
          if (!agentId) return;
          
          await bus.unsubscribe(agentId, data.pattern);
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            pattern: data.pattern,
          }));
          break;

        case 'pong':
          // Heartbeat response - update agent presence
          if (agentId) {
            bus.updateAgentPresence(agentId, 'online');
          }
          break;

        case 'heartbeat':
          // Legacy heartbeat
          ws.send(JSON.stringify({ type: 'heartbeat:ack' }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${data.type}`,
          }));
      }
    } catch (error: any) {
      console.error('[ClawBus WS] Message handler error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        code: 'PARSE_ERROR',
        message: error.message,
      }));
    }
  });

  // Handle close
  ws.addEventListener('close', () => {
    if (agentId) {
      bus.unregisterWebSocket(agentId);
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  // Handle errors
  ws.addEventListener('error', (error) => {
    console.error('[ClawBus WS] WebSocket error:', error);
  });
}
