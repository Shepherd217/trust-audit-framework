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
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', h).single()
  return data?.agent_id || null
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { contract_id, splits, execute_now } = await req.json()
  if (!contract_id || !splits?.length) return NextResponse.json({ error: 'contract_id and splits required' }, { status: 400 })
  const total = splits.reduce((s: number, x: any) => s + x.pct, 0)
  if (Math.abs(total - 100) > 0.01) return NextResponse.json({ error: 'Must sum to 100' }, { status: 400 })
  const { data: c } = await supabase.from('marketplace_contracts').select('id,worker_id,agreed_budget,job_id').eq('id', contract_id).eq('worker_id', agentId).single()
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const tc = Math.floor(c.agreed_budget * 0.975)
  const cfg = splits.map((s: any) => ({ agent_id: s.agent_id, pct: s.pct, credits: Math.floor(tc * s.pct / 100) }))
  const { data: rec, error } = await supabase.from('revenue_splits').insert({ contract_id, job_id: c.job_id, total_credits: tc, split_config: cfg, status: 'configured', created_by: agentId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('marketplace_contracts').update({ split_id: rec.id }).eq('id', contract_id)
  if (execute_now) {
    for (const s of cfg) {
      const { data: w } = await supabase.from('agent_wallets').select('balance').eq('agent_id', s.agent_id).single()
      const nb = (w?.balance || 0) + s.credits
      await supabase.from('agent_wallets').upsert({ agent_id: s.agent_id, balance: nb, total_earned: nb, currency: 'credits', updated_at: new Date().toISOString() }, { onConflict: 'agent_id' })
      await supabase.from('wallet_transactions').insert({ agent_id: s.agent_id, type: 'split', amount: s.credits, balance_after: nb, reference_id: rec.id, description: `Split ${s.pct}%` })
      await supabase.from('notifications').insert({ agent_id: s.agent_id, notification_type: 'payment.credit', title: `+${s.credits} credits split`, message: `${s.pct}% revenue split`, read: false })
    }
    await supabase.from('revenue_splits').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', rec.id)
  }
  return NextResponse.json({ success: true, split_id: rec.id, splits: cfg, total_credits: tc, status: execute_now ? 'executed' : 'configured' })
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cid = new URL(req.url).searchParams.get('contract_id')
  if (!cid) return NextResponse.json({ error: 'contract_id required' }, { status: 400 })
  const { data } = await getSupabase().from('revenue_splits').select('*').eq('contract_id', cid).single()
  if (!data) return NextResponse.json({ error: 'No split configured' }, { status: 404 })
  return NextResponse.json(data)
}
