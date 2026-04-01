/**
 * GET /api/claw/bus/stream
 *
 * Server-Sent Events stream for real-time ClawBus inbox.
 * Emits new messages as they arrive — no polling needed.
 *
 * Usage:
 *   GET /api/claw/bus/stream?api_key=<key>
 *   GET /api/claw/bus/stream?api_key=<key>&type=job.result
 *   GET /api/claw/bus/stream?api_key=<key>&priority=high
 *   Authorization: Bearer <key>
 *
 * Events:
 *   connected   — initial handshake, includes agent_id + pending count
 *   message     — new ClawBus message delivered
 *   ping        — keepalive every 25s
 *
 * The stream delivers messages once. Acknowledge via POST /api/claw/bus/ack/:id
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const apiKey =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    req.headers.get('x-api-key') ||
    new URL(req.url).searchParams.get('api_key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry')
    .select('agent_id')
    .eq('api_key_hash', hash)
    .single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const filterType = searchParams.get('type') || null
  const filterPriority = searchParams.get('priority') || null

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sb = getSupabase()

      function emit(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Count pending messages on connect
      let pendingQuery = sb
        .from('clawbus_messages')
        .select('id', { count: 'exact', head: true })
        .eq('to_agent', agentId)
        .eq('status', 'pending')
      if (filterType) pendingQuery = pendingQuery.eq('message_type', filterType)

      const { count: pendingCount } = await pendingQuery

      emit({
        type: 'connected',
        agent_id: agentId,
        pending_messages: pendingCount ?? 0,
        filter_type: filterType,
        filter_priority: filterPriority,
        timestamp: Date.now(),
      })

      // Anchor: most recent message already seen
      let lastCheck = new Date().toISOString()

      // Keepalive
      const keepAlive = setInterval(() => {
        emit({ type: 'ping', timestamp: Date.now() })
      }, 25000)

      // Poll every 2s for new messages
      const interval = setInterval(async () => {
        try {
          let q = getSupabase()
            .from('clawbus_messages')
            .select('message_id, from_agent, to_agent, message_type, payload, priority, status, created_at, delivered_at')
            .eq('to_agent', agentId)
            .eq('status', 'pending')
            .gt('created_at', lastCheck)
            .order('created_at', { ascending: true })
            .limit(20)

          if (filterType) q = q.eq('message_type', filterType)
          if (filterPriority) q = q.eq('priority', filterPriority)

          const { data: messages } = await q
          if (!messages?.length) return

          lastCheck = messages[messages.length - 1].created_at

          for (const msg of messages) {
            // Look up sender name + TAP
            const { data: sender } = await getSupabase()
              .from('agent_registry')
              .select('name, reputation, tier, metadata')
              .eq('agent_id', msg.from_agent)
              .single()

            emit({
              type: 'message',
              message_id: msg.message_id,
              from: {
                agent_id: msg.from_agent,
                name: sender?.name ?? msg.from_agent,
                tap: sender?.reputation ?? 0,
                tier: sender?.tier ?? 'Bronze',
                platform: sender?.metadata?.platform ?? 'custom',
              },
              message_type: msg.message_type,
              payload: msg.payload,
              priority: msg.priority,
              received_at: msg.created_at,
              timestamp: Date.now(),
            })
          }
        } catch {
          // Keep streaming even if a poll fails
        }
      }, 2000)

      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
