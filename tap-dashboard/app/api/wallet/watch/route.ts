/**
 * GET /api/wallet/watch
 *
 * Server-Sent Events stream for real-time wallet events.
 * Emits: wallet.credit, wallet.debit, wallet.transfer_in, wallet.transfer_out, wallet.withdrawal, ping
 *
 * Usage: GET /api/wallet/watch?api_key=<key>
 * Or:    Authorization: Bearer <key>
 *
 * Each event: { type, amount, balance_after, description, reference_id, timestamp }
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || req.headers.get('x-api-key')
    || new URL(req.url).searchParams.get('api_key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return new Response('Unauthorized', { status: 401 })

  // Optional filter: ?events=credit,transfer_in
  const { searchParams } = new URL(req.url)
  const filterEvents = searchParams.get('events')?.split(',').map(e => e.trim()) || null

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sb = getSupabase()

      function emit(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Connected confirmation + current balance
      const { data: wallet } = await sb
        .from('agent_wallets')
        .select('balance, pending_balance, total_earned')
        .eq('agent_id', agentId)
        .single()

      emit({
        type: 'connected',
        agent_id: agentId,
        balance: wallet?.balance ?? 0,
        usd_value: ((wallet?.balance ?? 0) / 100).toFixed(2),
        timestamp: Date.now(),
      })

      // Poll wallet_transactions for new entries every 3s
      let lastTxId: string | null = null

      // Get most recent tx to anchor polling
      const { data: anchor } = await sb
        .from('wallet_transactions')
        .select('id, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let lastCheck = anchor?.created_at ?? new Date().toISOString()
      lastTxId = anchor?.id ?? null

      const WALLET_EVENT_TYPES: Record<string, string> = {
        credit:        'wallet.credit',
        debit:         'wallet.debit',
        transfer_in:   'wallet.transfer_in',
        transfer_out:  'wallet.transfer_out',
        withdrawal:    'wallet.withdrawal',
        escrow_lock:   'wallet.escrow_lock',
        escrow_release: 'wallet.escrow_release',
      }

      // Separate keep-alive ping every 25s to prevent idle timeouts
      const keepAlive = setInterval(() => {
        try { emit({ type: 'ping', timestamp: Date.now() }) } catch {} // intentional
      }, 25000)

      const interval = setInterval(async () => {
        try {

          const { data: newTxs } = await getSupabase()
            .from('wallet_transactions')
            .select('id, type, amount, balance_after, description, reference_id, created_at')
            .eq('agent_id', agentId)
            .gt('created_at', lastCheck)
            .order('created_at', { ascending: true })

          if (!newTxs?.length) return
          lastCheck = newTxs[newTxs.length - 1].created_at

          for (const tx of newTxs) {
            if (tx.id === lastTxId) continue
            lastTxId = tx.id

            const eventType = WALLET_EVENT_TYPES[tx.type] ?? `wallet.${tx.type}`

            // Apply filter if set
            if (filterEvents && !filterEvents.some(f => eventType.includes(f))) continue

            emit({
              type: eventType,
              tx_id: tx.id,
              amount: tx.amount,
              usd: (Math.abs(tx.amount) / 100).toFixed(2),
              balance_after: tx.balance_after,
              balance_usd: ((tx.balance_after ?? 0) / 100).toFixed(2),
              description: tx.description,
              reference_id: tx.reference_id,
              timestamp: new Date(tx.created_at).getTime(),
            })
          }
        } catch {
          // Stream continues even if a poll fails
        }
      }, 3000)

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        clearInterval(interval)
        try { controller.close() } catch {} // intentional
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
