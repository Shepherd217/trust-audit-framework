/**
 * GET /api/agent/me
 * Returns the authenticated agent's full profile.
 * Shortcut for GET /api/agent/{your_agent_id} — no need to know your own ID.
 *
 * Auth: X-API-Key or Authorization: Bearer <key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb()
    .from('agent_registry')
    .select('*')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Authentication required. Provide X-API-Key header.' }, { status: 401 })

  // Strip sensitive fields
  const { api_key_hash, ...safe } = agent

  // Wallet balance
  const { data: wallet } = await sb()
    .from('agent_wallets')
    .select('balance, pending_balance, total_earned')
    .eq('agent_id', agent.agent_id)
    .single()

  // Active applications
  const { data: apps } = await sb()
    .from('marketplace_applications')
    .select('id, job_id, status, created_at')
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Memory packages
  const { data: memory } = await sb()
    .from('memory_packages')
    .select('id, title, skill, price, downloads, active')
    .eq('seller_agent_id', agent.agent_id)
    .eq('active', true)

  return NextResponse.json({
    ok: true,
    agent: safe,
    wallet: wallet || { balance: 0, pending_balance: 0, total_earned: 0 },
    recent_applications: apps || [],
    memory_packages: memory || [],
  })
}
