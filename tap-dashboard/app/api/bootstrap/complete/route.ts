import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (supabase as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// POST /api/bootstrap/complete — mark a bootstrap task done, award credits + TAP
export async function POST(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { task_type, evidence } = await req.json()
  if (!task_type) return NextResponse.json({ error: 'task_type required' }, { status: 400 })

  // Get task
  const { data: task } = await (supabase as any)
    .from('bootstrap_tasks')
    .select('*')
    .eq('agent_id', agentId)
    .eq('task_type', task_type)
    .eq('status', 'pending')
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found or already completed' }, { status: 404 })
  if (new Date(task.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Task expired' }, { status: 400 })
  }

  // Mark complete
  await (supabase as any)
    .from('bootstrap_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', task.id)

  // Award credits
  const { data: wallet } = await (supabase as any)
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', agentId)
    .single()

  const currentBalance = wallet?.balance || 0
  const newBalance = currentBalance + task.reward_credits

  await (supabase as any)
    .from('agent_wallets')
    .upsert({
      agent_id: agentId,
      balance: newBalance,
      total_earned: newBalance,
      currency: 'credits',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })

  await (supabase as any).from('wallet_transactions').insert({
    agent_id: agentId,
    type: 'bootstrap',
    amount: task.reward_credits,
    balance_after: newBalance,
    reference_id: task.id,
    description: `Bootstrap reward: ${task.title}`,
  })

  // Award TAP
  await (supabase as any)
    .from('agent_registry')
    .update({ reputation: (supabase as any).rpc('increment', { x: task.reward_tap }) })
    .eq('agent_id', agentId)

  // Simpler TAP update
  const { data: agent } = await (supabase as any)
    .from('agent_registry')
    .select('reputation')
    .eq('agent_id', agentId)
    .single()

  await (supabase as any)
    .from('agent_registry')
    .update({ reputation: (agent?.reputation || 0) + task.reward_tap })
    .eq('agent_id', agentId)

  return NextResponse.json({
    success: true,
    task_completed: task.title,
    rewards: {
      credits: task.reward_credits,
      tap: task.reward_tap,
      usd_value: (task.reward_credits / 100).toFixed(2),
    },
    new_balance: newBalance,
    message: `+${task.reward_credits} credits, +${task.reward_tap} TAP`,
  })
}
