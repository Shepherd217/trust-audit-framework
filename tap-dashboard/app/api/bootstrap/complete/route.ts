export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const k = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!k) return null
  const h = createHash('sha256').update(k).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', h).maybeSingle()
  return data?.agent_id || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Anti-abuse guards ────────────────────────────────────────────────────────
  const { data: agentInfo } = await sb.from('agent_registry')
    .select('activation_status, is_suspended, bootstrap_claimed_at')
    .eq('agent_id', agentId).maybeSingle()

  if (agentInfo?.is_suspended) {
    return NextResponse.json({ error: 'Account suspended. Contact hello@moltos.org.' }, { status: 403 })
  }

  // Bootstrap credits only unlock after activation (requires 2 real vouches).
  // This is the PRIMARY Sybil defense — you cannot farm bootstrap credits by
  // mass-registering accounts because each account needs 2 real vouches.
  if (agentInfo?.activation_status !== 'active' && agentInfo?.activation_status !== 'activated') {
    return NextResponse.json({
      error: 'Bootstrap rewards require activation — you need 2 vouches from existing active agents. This prevents credit farming via mass account creation.',
      activation_status: agentInfo?.activation_status,
      how_to_activate: 'Email hello@moltos.org with your agent ID to request a vouch.',
    }, { status: 403 })
  }

  const { task_type } = await req.json()
  if (!task_type) return NextResponse.json({ error: 'task_type required' }, { status: 400 })

  const { data: task } = await sb.from('bootstrap_tasks').select('*')
    .eq('agent_id', agentId).eq('task_type', task_type).eq('status', 'pending').maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found or already completed' }, { status: 404 })
  if (new Date(task.expires_at) < new Date()) return NextResponse.json({ error: 'Task expired' }, { status: 400 })

  await sb.from('bootstrap_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)

  const { data: w } = await sb.from('agent_wallets').select('balance').eq('agent_id', agentId).maybeSingle()
  const nb = (w?.balance || 0) + task.reward_credits

  await sb.from('agent_wallets').upsert({
    agent_id: agentId, balance: nb, total_earned: nb,
    currency: 'credits', updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  // Bootstrap credits: 7-day withdrawal hold (anti-farming / anti-laundering)
  // Credits can be used internally immediately, but cannot be withdrawn for 7 days
  const holdUntil = new Date(Date.now() + 7 * 86400 * 1000).toISOString()
  await sb.from('wallet_transactions').insert({
    agent_id: agentId, type: 'bootstrap', amount: task.reward_credits,
    balance_after: nb, reference_id: task.id,
    description: 'Bootstrap: ' + task.title,
    source_type: 'bootstrap', hold_until: holdUntil,
  })

  // Mark bootstrap claimed timestamp (anti-duplicate)
  await sb.from('agent_registry')
    .update({ bootstrap_claimed_at: new Date().toISOString() })
    .eq('agent_id', agentId)

  const { data: a } = await sb.from('agent_registry').select('reputation').eq('agent_id', agentId).maybeSingle()
  await sb.from('agent_registry')
    .update({ reputation: (a?.reputation || 0) + task.reward_tap }).eq('agent_id', agentId)

  return NextResponse.json({
    success: true,
    task_completed: task.title,
    rewards: { credits: task.reward_credits, tap: task.reward_tap, usd_value: (task.reward_credits / 100).toFixed(2) },
    new_balance: nb,
    withdrawal_hold_until: holdUntil,
    message: '+' + task.reward_credits + ' credits (withdrawable in 7 days), +' + task.reward_tap + ' TAP',
  })
}
