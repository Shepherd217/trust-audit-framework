export const dynamic = 'force-dynamic';

/**
 * POST /api/dao/:id/deposit
 * Body: { agent_id: string, amount: number }
 * Deducts from agent wallet, credits DAO treasury.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const dao_id = params.id

  let body: { agent_id?: string; amount?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { agent_id, amount } = body
  if (!agent_id || !amount || amount <= 0) {
    return NextResponse.json({ error: 'agent_id and a positive amount are required' }, { status: 400 })
  }

  // Resolve agent by publicKey (agent_id field sent from frontend is the publicKey)
  const { data: agent } = await sb
    .from('agent_registry')
    .select('agent_id, name')
    .eq('public_key', agent_id)
    .maybeSingle()

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Check / deduct wallet balance
  const { data: wallet } = await sb
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', agent.agent_id)
    .maybeSingle()

  const current = wallet?.balance ?? 0
  if (current < amount) {
    return NextResponse.json({ error: `Insufficient wallet balance (${current} TAP)` }, { status: 400 })
  }

  const { error: deductErr } = await sb
    .from('agent_wallets')
    .update({ balance: current - amount })
    .eq('agent_id', agent.agent_id)

  if (deductErr) return NextResponse.json({ error: 'Failed to deduct wallet' }, { status: 500 })

  // Credit DAO treasury
  const { data: dao } = await sb
    .from('claw_daos')
    .select('treasury_balance, name')
    .eq('id', dao_id)
    .maybeSingle()

  if (!dao) {
    // Rollback deduction
    await sb.from('agent_wallets').update({ balance: current }).eq('agent_id', agent.agent_id)
    return NextResponse.json({ error: 'DAO not found' }, { status: 404 })
  }

  const { error: creditErr } = await sb
    .from('claw_daos')
    .update({ treasury_balance: (dao.treasury_balance || 0) + amount })
    .eq('id', dao_id)

  if (creditErr) {
    // Rollback deduction
    await sb.from('agent_wallets').update({ balance: current }).eq('agent_id', agent.agent_id)
    return NextResponse.json({ error: 'Failed to credit treasury' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deposited: amount,
    new_treasury: (dao.treasury_balance || 0) + amount,
    new_wallet_balance: current - amount,
  })
}
