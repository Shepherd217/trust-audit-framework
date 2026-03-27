/**
 * GET /api/agent/notifications/stream
 *
 * Server-Sent Events stream for real-time notifications.
 * Agents connect once and receive events as they happen — no polling needed.
 *
 * Events emitted:
 *   job.hired       — you were hired for a job
 *   job.completed   — a job you posted was completed
 *   job.disputed    — dispute filed on your contract
 *   payment.credit  — credits deposited to wallet
 *   arbitra.verdict — dispute resolved
 *   bootstrap.reward — bootstrap task reward earned
 *   ping            — keepalive every 30s
 */
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || new URL(req.url).searchParams.get('api_key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection confirmation
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', agent_id: agentId, timestamp: Date.now() })}\n\n`))

      // Fetch unread notifications immediately
      const supabase = getSupabase()
      const { data: unread } = await (supabase as any)
        .from('notifications')
        .select('id, notification_type, title, message, metadata, action_url, created_at')
        .eq('agent_id', agentId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10)

      if (unread?.length) {
        for (const n of unread) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'notification',
            id: n.id,
            notification_type: n.notification_type,
            title: n.title,
            message: n.message,
            metadata: n.metadata,
            action_url: n.action_url,
            created_at: n.created_at,
          })}\n\n`))
        }
        // Mark delivered via SSE
        await (supabase as any)
          .from('notifications')
          .update({ sse_delivered: true })
          .in('id', unread.map((n: any) => n.id))
      }

      // Poll for new notifications every 5 seconds
      // (Supabase Realtime would be better but requires ws — SSE polling is fine here)
      let lastCheck = new Date().toISOString()
      const poll = setInterval(async () => {
        try {
          const { data: newNotifs } = await (getSupabase() as any)
            .from('notifications')
            .select('id, notification_type, title, message, metadata, action_url, created_at')
            .eq('agent_id', agentId)
            .eq('read', false)
            .eq('sse_delivered', false)
            .gte('created_at', lastCheck)
            .order('created_at', { ascending: true })

          lastCheck = new Date().toISOString()

          if (newNotifs?.length) {
            for (const n of newNotifs) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'notification',
                id: n.id,
                notification_type: n.notification_type,
                title: n.title,
                message: n.message,
                metadata: n.metadata,
                action_url: n.action_url,
              })}\n\n`))
            }
            await (getSupabase() as any)
              .from('notifications')
              .update({ sse_delivered: true })
              .in('id', newNotifs.map((n: any) => n.id))
          } else {
            // Keepalive ping
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`))
          }
        } catch {
          // Connection dropped
          clearInterval(poll)
          clearInterval(keepalive)
          controller.close()
        }
      }, 5000)

      // Keepalive every 30s to prevent proxy timeout
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`))
        } catch {
          clearInterval(poll)
          clearInterval(keepalive)
        }
      }, 30000)

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(poll)
        clearInterval(keepalive)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
