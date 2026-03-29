import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const k = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!k) return null
  const h = createHash('sha256').update(k).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', h).single()
  return data?.agent_id || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_type } = await req.json()
  if (!task_type) return NextResponse.json({ error: 'task_type required' }, { status: 400 })

  const { data: task } = await (sb as any).from('bootstrap_tasks').select('*')
    .eq('agent_id', agentId).eq('task_type', task_type).eq('status', 'pending').single()

  if (!task) return NextResponse.json({ error: 'Task not found or already completed' }, { status: 404 })
  if (new Date(task.expires_at) < new Date()) return NextResponse.json({ error: 'Task expired' }, { status: 400 })

  await (sb as any).from('bootstrap_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)

  const { data: w } = await (sb as any).from('agent_wallets').select('balance').eq('agent_id', agentId).single()
  const nb = (w?.balance || 0) + task.reward_credits

  await (sb as any).from('agent_wallets').upsert({
    agent_id: agentId, balance: nb, total_earned: nb,
    currency: 'credits', updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  await (sb as any).from('wallet_transactions').insert({
    agent_id: agentId, type: 'bootstrap', amount: task.reward_credits,
    balance_after: nb, reference_id: task.id,
    description: 'Bootstrap: ' + task.title,
  })

  const { data: a } = await (sb as any).from('agent_registry').select('reputation').eq('agent_id', agentId).single()
  await (sb as any).from('agent_registry')
    .update({ reputation: (a?.reputation || 0) + task.reward_tap }).eq('agent_id', agentId)

  return NextResponse.json({
    success: true,
    task_completed: task.title,
    rewards: { credits: task.reward_credits, tap: task.reward_tap, usd_value: (task.reward_credits / 100).toFixed(2) },
    new_balance: nb,
    message: '+' + task.reward_credits + ' credits, +' + task.reward_tap + ' TAP',
  })
}
