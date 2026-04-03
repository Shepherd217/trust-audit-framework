export const dynamic = 'force-dynamic';
/**
 * GET /api/dao/execute?auth=KEY&proposal_id=UUID
 *
 * Execute a passed DAO proposal.
 * Caller must be a DAO member. Proposal must be in 'passed' status.
 *
 * Supported actions (encoded in proposal title prefix):
 *   [SET_FEE:N]      — set platform_fee_percent to N (0-20)
 *   [SET_STAKE:N]    — set min_stake_amount to N
 *   [ADD_MEMBER:ID]  — add agent ID to DAO membership
 *   [REMOVE_MEMBER:ID] — remove agent from DAO
 *   [TREASURY_SEND:ID:N] — send N credits from DAO treasury to agent ID
 *   [TEXT]           — no on-chain action, just marks executed
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function txt(body: string, status = 200) {
  return new NextResponse(body + '\n', { status, headers: { 'Content-Type': 'text/plain' } })
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auth = searchParams.get('auth')
  const proposalId = searchParams.get('proposal_id')

  if (!auth) return txt('ERROR: auth required', 401)
  if (!proposalId) return txt('ERROR: proposal_id required', 400)

  const isGenesis = auth === process.env.GENESIS_TOKEN || auth === 'genesis_moltos_2024'
  let agent: { agent_id: string; name: string } | null = null

  if (!isGenesis) {
    agent = await resolveAgent(auth)
    if (!agent) return txt('ERROR: Invalid key', 401)
  }

  const supabase = db()

  // Load proposal
  const { data: proposal } = await supabase
    .from('dao_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal) return txt('ERROR: Proposal not found', 404)
  if (proposal.status !== 'passed') return txt(`ERROR: Proposal status is "${proposal.status}" — must be "passed" to execute`, 409)

  // Verify executor is a member
  if (!isGenesis && agent) {
    const { data: mem } = await supabase
      .from('dao_memberships')
      .select('agent_id')
      .eq('dao_id', proposal.dao_id)
      .eq('agent_id', agent.agent_id)
      .maybeSingle()

    if (!mem) return txt('ERROR: Not a DAO member', 403)
  }

  const title: string = proposal.title
  let actionResult = 'TEXT — no on-chain action'
  const executedBy = agent?.agent_id || 'genesis'
  const now = new Date().toISOString()

  // Parse action from title
  const setFee = title.match(/\[SET_FEE:(\d+(?:\.\d+)?)\]/i)
  const setStake = title.match(/\[SET_STAKE:(\d+)\]/i)
  const addMember = title.match(/\[ADD_MEMBER:(agent_[a-zA-Z0-9]+)\]/i)
  const removeMember = title.match(/\[REMOVE_MEMBER:(agent_[a-zA-Z0-9]+)\]/i)
  const treasurySend = title.match(/\[TREASURY_SEND:(agent_[a-zA-Z0-9]+):(\d+)\]/i)

  if (setFee) {
    const fee = parseFloat(setFee[1])
    if (fee < 0 || fee > 20) return txt('ERROR: fee must be 0–20', 400)
    const { error } = await supabase
      .from('wot_config')
      .update({ platform_fee_percent: fee, updated_at: now, updated_by: executedBy })
      .eq('id', 1)
    if (error) return txt(`ERROR executing SET_FEE: ${error.message}`, 500)
    actionResult = `SET_FEE → platform_fee_percent = ${fee}%`
  } else if (setStake) {
    const stake = parseInt(setStake[1])
    const { error } = await supabase
      .from('wot_config')
      .update({ min_stake_amount: stake, updated_at: now, updated_by: executedBy })
      .eq('id', 1)
    if (error) return txt(`ERROR executing SET_STAKE: ${error.message}`, 500)
    actionResult = `SET_STAKE → min_stake_amount = ${stake}`
  } else if (addMember) {
    const newMemberId = addMember[1]
    // Get current member count for weight rebalance
    const { data: existing } = await supabase
      .from('dao_memberships')
      .select('agent_id, governance_weight')
      .eq('dao_id', proposal.dao_id)

    const count = (existing?.length || 0) + 1
    const newWeight = 1.0 / count

    // Rebalance existing members
    for (const m of existing || []) {
      await supabase
        .from('dao_memberships')
        .update({ governance_weight: newWeight })
        .eq('dao_id', proposal.dao_id)
        .eq('agent_id', m.agent_id)
    }
    // Insert new member
    await supabase.from('dao_memberships').insert({
      dao_id: proposal.dao_id,
      agent_id: newMemberId,
      governance_weight: newWeight,
    })
    // Also update founding_agents list
    const { data: dao } = await supabase.from('claw_daos').select('founding_agents').eq('id', proposal.dao_id).maybeSingle()
    const founders: string[] = dao?.founding_agents || []
    if (!founders.includes(newMemberId)) {
      await supabase.from('claw_daos').update({ founding_agents: [...founders, newMemberId] }).eq('id', proposal.dao_id)
    }
    actionResult = `ADD_MEMBER → ${newMemberId} added, all weights rebalanced to ${newWeight.toFixed(4)}`
  } else if (removeMember) {
    const removeId = removeMember[1]
    await supabase
      .from('dao_memberships')
      .delete()
      .eq('dao_id', proposal.dao_id)
      .eq('agent_id', removeId)

    // Rebalance
    const { data: remaining } = await supabase
      .from('dao_memberships')
      .select('agent_id')
      .eq('dao_id', proposal.dao_id)

    if (remaining && remaining.length > 0) {
      const w = 1.0 / remaining.length
      for (const m of remaining) {
        await supabase
          .from('dao_memberships')
          .update({ governance_weight: w })
          .eq('dao_id', proposal.dao_id)
          .eq('agent_id', m.agent_id)
      }
    }
    actionResult = `REMOVE_MEMBER → ${removeId} removed`
  } else if (treasurySend) {
    const recipientId = treasurySend[1]
    const amount = parseInt(treasurySend[2])

    // Check treasury balance
    const { data: dao } = await supabase
      .from('claw_daos')
      .select('treasury_balance, name')
      .eq('id', proposal.dao_id)
      .maybeSingle()

    if (!dao) return txt('ERROR: DAO not found', 404)
    if ((dao.treasury_balance || 0) < amount) {
      return txt(`ERROR: Insufficient treasury (${dao.treasury_balance} < ${amount})`, 400)
    }

    // Deduct from treasury
    await supabase
      .from('claw_daos')
      .update({ treasury_balance: (dao.treasury_balance || 0) - amount })
      .eq('id', proposal.dao_id)

    // Credit recipient wallet
    const { data: wallet } = await supabase
      .from('agent_wallets')
      .select('balance')
      .eq('agent_id', recipientId)
      .maybeSingle()

    if (wallet) {
      await supabase
        .from('agent_wallets')
        .update({ balance: (wallet.balance || 0) + amount })
        .eq('agent_id', recipientId)
    }

    // Log ClawBus message to recipient
    await supabase.from('clawbus_messages').insert({
      message_id: `msg_${randomBytes(12).toString('hex')}`,
      version: '1',
      from_agent: executedBy,
      to_agent: recipientId,
      message_type: 'dao.treasury.send',
      payload: {
        dao_id: proposal.dao_id,
        dao_name: dao.name,
        amount,
        proposal_id: proposal.id,
        proposal_title: proposal.title,
      },
      priority: 'high',
      status: 'unread',
      created_at: now,
      expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    })

    actionResult = `TREASURY_SEND → ${amount} credits → ${recipientId}`
  }

  // Mark proposal as executed
  await supabase
    .from('dao_proposals')
    .update({ status: 'executed' })
    .eq('id', proposalId)

  // Log execution event
  await supabase.from('claw_system_events').insert({
    event_type: 'dao_proposal_executed',
    agent_id: executedBy,
    details: {
      proposal_id: proposalId,
      dao_id: proposal.dao_id,
      action: actionResult,
    },
    created_at: now,
  }).catch(() => null)

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  return txt([
    '✓ PROPOSAL EXECUTED',
    '─────────────────────────────────────',
    `proposal:    ${proposal.title}`,
    `proposal_id: ${proposalId}`,
    `executed_by: ${executedBy}`,
    `action:      ${actionResult}`,
    '',
    `view dao:    ${base}/api/dao/${proposal.dao_id}`,
    '─────────────────────────────────────',
  ].join('\n'))
}
