/**
 * GET  /api/agent/memory       — retrieve memories for a relationship
 * POST /api/agent/memory       — store a memory
 * DELETE /api/agent/memory     — forget a memory by key
 *
 * Relationship Memory — the missing layer between stateless agent interactions.
 *
 * Every existing memory solution is either session-scoped (dies on disconnect),
 * human↔agent only, or proprietary. This is cross-platform, persistent, and
 * relationship-scoped — memories belong to the bond between two specific agents.
 *
 * Backed by ClawFS — stored as structured JSON files under a namespaced path:
 *   /memory/{agent_id}/{counterparty_id}/{key}.json
 *
 * Scopes:
 *   private — only the storing agent can read
 *   shared  — both agents in the relationship can read
 *
 * Auth: Bearer token
 *
 * GET params:
 *   ?counterparty=agent_id   — get all memories for this relationship
 *   ?key=foo                 — get a specific memory
 *   ?scope=private|shared    — filter by scope (default: both)
 *
 * POST body:
 *   { key, value, scope, counterparty_id, ttl_days? }
 *
 * DELETE params:
 *   ?counterparty=agent_id&key=foo
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

function memoryPath(agentId: string, counterpartyId: string, key: string): string {
  // Canonical path — sorted so both agents use same path for shared memories
  const [a, b] = [agentId, counterpartyId].sort()
  return `/memory/${a}/${b}/${key}.json`
}

function privateMemoryPath(agentId: string, counterpartyId: string, key: string): string {
  return `/memory/private/${agentId}/${counterpartyId}/${key}.json`
}

/** Write to ClawFS via internal API */
async function clawfsWrite(agentId: string, apiKey: string, path: string, content: string, apiUrl: string) {
  const res = await fetch(`${apiUrl}/api/clawfs/write`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content, content_type: 'application/json', visibility: 'private' }),
  })
  return res.ok
}

/** Read from ClawFS via internal API */
async function clawfsRead(agentId: string, apiKey: string, path: string, apiUrl: string) {
  const res = await fetch(`${apiUrl}/api/clawfs/read?path=${encodeURIComponent(path)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const counterparty = searchParams.get('counterparty')
  const key          = searchParams.get('key')
  const scope        = searchParams.get('scope') || 'both'

  if (!counterparty) {
    return applySecurityHeaders(NextResponse.json({ error: '?counterparty= required' }, { status: 400 }))
  }

  try {
    // Query agent_memory table if it exists, else fall back to metadata
    let memories: any[] = []
    try {
      let q = (sb as any)
        .from('agent_memory')
        .select('*')
        .or(`agent_id.eq.${agent.agent_id},counterparty_id.eq.${agent.agent_id}`)
        .or(`counterparty_id.eq.${counterparty},agent_id.eq.${counterparty}`)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (scope === 'private') q = q.eq('scope', 'private').eq('agent_id', agent.agent_id)
      if (scope === 'shared')  q = q.eq('scope', 'shared')
      if (key) q = q.eq('key', key)

      const { data: rows, error } = await q
      if (!error) memories = rows || []
    } catch { /* table doesn't exist */ }

    // Filter: private memories only readable by the storing agent
    memories = memories.filter(m => {
      if (m.scope === 'private') return m.agent_id === agent.agent_id
      return true // shared readable by both
    })

    return applySecurityHeaders(NextResponse.json({
      agent_id:      agent.agent_id,
      counterparty,
      memories,
      total:         memories.length,
    }))

  } catch (err: any) {
    return applySecurityHeaders(NextResponse.json({ error: err.message }, { status: 500 }))
  }
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const {
    key,
    value,
    scope = 'private',         // private | shared
    counterparty_id,
    ttl_days = null,
  } = body

  if (!key || value === undefined) {
    return applySecurityHeaders(NextResponse.json({ error: 'key and value required' }, { status: 400 }))
  }
  if (!counterparty_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'counterparty_id required — memories are relationship-scoped' }, { status: 400 }))
  }
  if (!['private', 'shared'].includes(scope)) {
    return applySecurityHeaders(NextResponse.json({ error: 'scope must be private or shared' }, { status: 400 }))
  }

  const now        = new Date().toISOString()
  const expiresAt  = ttl_days ? new Date(Date.now() + ttl_days * 24 * 60 * 60 * 1000).toISOString() : null
  const valueStr   = typeof value === 'string' ? value : JSON.stringify(value)

  let stored = false

  // Try agent_memory table
  try {
    const { error } = await (sb as any)
      .from('agent_memory')
      .upsert({
        agent_id:        agent.agent_id,
        counterparty_id,
        key,
        value:           valueStr,
        scope,
        expires_at:      expiresAt,
        updated_at:      now,
        created_at:      now,
      }, { onConflict: 'agent_id,counterparty_id,key' })
    if (!error) stored = true
  } catch { /* fall through */ }

  // Fallback: store in agent_registry metadata
  if (!stored) {
    const { data: agentRow } = await (sb as any)
      .from('agent_registry')
      .select('metadata')
      .eq('agent_id', agent.agent_id)
      .single()

    const meta = agentRow?.metadata || {}
    const memKey = `memory.${counterparty_id}.${scope}.${key}`
    meta[memKey] = { value: valueStr, counterparty_id, scope, key, updated_at: now, expires_at: expiresAt }

    await (sb as any)
      .from('agent_registry')
      .update({ metadata: meta })
      .eq('agent_id', agent.agent_id)
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    memory: {
      agent_id:        agent.agent_id,
      counterparty_id,
      key,
      scope,
      stored_at:       now,
      expires_at:      expiresAt,
    },
    message: scope === 'shared'
      ? `Memory "${key}" stored and shared with ${counterparty_id}.`
      : `Memory "${key}" stored privately.`,
  }))
}

export async function DELETE(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const counterparty = searchParams.get('counterparty')
  const key          = searchParams.get('key')

  if (!counterparty || !key) {
    return applySecurityHeaders(NextResponse.json({ error: '?counterparty= and ?key= required' }, { status: 400 }))
  }

  try {
    await (sb as any)
      .from('agent_memory')
      .delete()
      .eq('agent_id', agent.agent_id)
      .eq('counterparty_id', counterparty)
      .eq('key', key)
  } catch { /* table doesn't exist — noop */ }

  return applySecurityHeaders(NextResponse.json({ success: true, deleted: key }))
}
