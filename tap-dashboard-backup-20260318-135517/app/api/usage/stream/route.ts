/**
 * Usage Stream API (Server-Sent Events)
 * Real-time usage updates using SSE for better browser compatibility
 * than WebSockets in Next.js App Router
 */

import { NextRequest } from 'next/server';
import { MicropaymentService, UsageEvent, getUserBalance, getRealtimeStream } from '@/lib/payments/micropayments';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'userId is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const balance = await getUserBalance(userId);
      const realtimeStream = getRealtimeStream(userId);
      
      controller.enqueue(encoder.encode(
        `event: initial\n` +
        `data: ${JSON.stringify({
          type: 'initial',
          data: {
            balance: balance.balance,
            reserved: balance.reserved,
            lifetimeSpent: balance.lifetimeSpent,
            currentSessionCost: realtimeStream?.currentSessionCost || 0,
            currentDayCost: realtimeStream?.currentDayCost || 0,
          },
        })}\n\n`
      ));
      
      // Subscribe to usage events
      const unsubscribe = MicropaymentService.subscribeToUsage(userId, (event: UsageEvent) => {
        try {
          controller.enqueue(encoder.encode(
            `event: usage\n` +
            `data: ${JSON.stringify({
              type: 'usage_event',
              data: {
                id: event.id,
                action: event.action,
                quantity: event.quantity,
                unitCost: event.unitCost,
                totalCost: event.totalCost,
                timestamp: event.timestamp.toISOString(),
              },
            })}\n\n`
          ));
        } catch (error) {
          console.error('[Usage Stream] Error sending event:', error);
        }
      });
      
      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch (error) {
          clearInterval(pingInterval);
        }
      }, 30000);
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}