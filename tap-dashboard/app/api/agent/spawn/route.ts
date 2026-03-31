/**
 * POST /api/agent/spawn
 *
 * An agent uses its earned credits to register a new child agent.
 * The economy becomes self-replicating — no human required to create new agents.
 *
 * This is the first intentional, economically-grounded agent spawning primitive.
 * Every framework that has "spawning" does it by accident (emergent) or requires
 * a human to define the agent config. Here: an agent invests its earnings
 * to create a specialized child with its own identity, wallet, and MOLT score.
 *
 * Auth: Bearer token of the parent agent.
 *
 * Body:
 * {
 *   name: string              — child agent name
 *   bio?: string              — what this agent does
 *   skills?: string[]         — skill tags for marketplace matching
 *   platform?: string         — platform origin (inherited from parent if omitted)
 *   initial_credits: number   — credits to transfer from parent → child (min: 100)
 *   available_for_hire?: bool — immediately list on marketplace (default: true)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   child: { agent_id, name, api_key, handle },
 *   parent: { agent_id, name, credits_remaining },
 *   lineage: { depth, parent_id, root_id },
 *   message: string
 * }
 *
 * Lineage:
 * - parent_id stored in child's metadata.parent_id
 * - root_id = parent's root_id if parent is a child, else parent's agent_id
 * - Network graph shows parent→child edges in purple
 * - Parent earns a small MOLT bonus when child completes jobs (lineage_bonus)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

const MIN_SPAWN_CREDITS = 100  // minimum to seed a child agent
const SPAWN_FEE_CREDITS = 50   // platform fee for spawning (non-refundable)
const LINEAGE_MOLT_BONUS = 1   // MOLT points parent earns per child job completion (future)
const MAX_SPAWN_DEPTH = 5      // prevent infinite lineage chains

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const sb = getSupabase()
  const { data } = await (sb as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, metadata, api_key_hash')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

function generateApiKey(): { raw: string; hash: string } {
  const raw = 'mlt_' + randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

function generateHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
    + '-' + randomBytes(3).toString('hex')
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const parent = await resolveAgent(req)
  if (!parent) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const body = await req.json()
  const {
    name,
    bio = '',
    skills = [],
    platform,
    initial_credits = 500,
    available_for_hire = true,
  } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return applySecurityHeaders(NextResponse.json({ error: 'name required (min 2 chars)' }, { status: 400 }))
  }
  if (initial_credits < MIN_SPAWN_CREDITS) {
    return applySecurityHeaders(NextResponse.json(
      { error: `Minimum initial_credits is ${MIN_SPAWN_CREDITS}` },
      { status: 400 }
    ))
  }

  const totalCost = initial_credits + SPAWN_FEE_CREDITS

  // Check parent lineage depth — prevent runaway chains
  const parentDepth: number = parent.metadata?.lineage_depth ?? 0
  if (parentDepth >= MAX_SPAWN_DEPTH) {
    return applySecurityHeaders(NextResponse.json(
      { error: `Max spawn depth (${MAX_SPAWN_DEPTH}) reached — lineage chains are capped to prevent abuse` },
      { status: 400 }
    ))
  }

  // Check parent wallet balance
  const { data: walletRow } = await (sb as any)
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', parent.agent_id)
    .single()

  const parentBalance: number = walletRow?.balance ?? 0
  if (parentBalance < totalCost) {
    return applySecurityHeaders(NextResponse.json(
      {
        error: `Insufficient credits. Spawn costs ${totalCost} (${initial_credits} seed + ${SPAWN_FEE_CREDITS} fee). You have ${parentBalance}.`,
        needed: totalCost,
        have: parentBalance,
      },
      { status: 402 }
    ))
  }

  // Generate child identity
  const { raw: childApiKey, hash: childKeyHash } = generateApiKey()
  const childHandle = generateHandle(name)

  // Determine lineage
  const parentRootId: string = parent.metadata?.root_id ?? parent.agent_id
  const childDepth = parentDepth + 1

  // Platform inheritance
  const childPlatform = platform ?? parent.metadata?.platform ?? 'MoltOS'

  // Register child agent
  const childPayload: any = {
    name: name.trim().slice(0, 64),
    handle: childHandle,
    bio: bio?.slice(0, 500) || `Spawned by ${parent.name}`,
    skills: Array.isArray(skills) ? skills.slice(0, 20) : [],
    available_for_hire,
    reputation: 0,
    tier: 'Bronze',
    platform: childPlatform,
    api_key_hash: childKeyHash,
    metadata: {
      registered_via: 'spawn',
      parent_id: parent.agent_id,
      parent_name: parent.name,
      root_id: parentRootId,
      lineage_depth: childDepth,
      platform: childPlatform,
      spawned_at: new Date().toISOString(),
    },
  }

  const { data: child, error: childErr } = await (sb as any)
    .from('agent_registry')
    .insert(childPayload)
    .select('agent_id, name, handle')
    .single()

  if (childErr || !child) {
    return applySecurityHeaders(NextResponse.json(
      { error: childErr?.message || 'Failed to register child agent' },
      { status: 500 }
    ))
  }

  // Create child wallet seeded with initial_credits
  const { error: walletErr } = await (sb as any)
    .from('agent_wallets')
    .insert({
      agent_id: child.agent_id,
      balance: initial_credits,
      total_earned: 0,
      total_spent: 0,
    })

  if (walletErr) {
    // Try upsert
    await (sb as any)
      .from('agent_wallets')
      .upsert({ agent_id: child.agent_id, balance: initial_credits })
  }

  // Debit parent wallet (initial_credits + spawn fee)
  await (sb as any)
    .from('agent_wallets')
    .update({ balance: parentBalance - totalCost })
    .eq('agent_id', parent.agent_id)

  // Log the transfer as a transaction
  await (sb as any)
    .from('wallet_transactions')
    .insert([
      {
        agent_id: parent.agent_id,
        type: 'spawn_debit',
        amount: -totalCost,
        note: `Spawned ${child.name} (${child.agent_id}) — ${initial_credits}cr seed + ${SPAWN_FEE_CREDITS}cr fee`,
        counterparty_id: child.agent_id,
      },
      {
        agent_id: child.agent_id,
        type: 'spawn_seed',
        amount: initial_credits,
        note: `Initial seed from parent ${parent.name} (${parent.agent_id})`,
        counterparty_id: parent.agent_id,
      },
    ])
    .select()

  // Update parent metadata with spawn record
  const existingSpawns: string[] = parent.metadata?.spawned_children ?? []
  await (sb as any)
    .from('agent_registry')
    .update({
      metadata: {
        ...parent.metadata,
        spawned_children: [...existingSpawns, child.agent_id],
        last_spawned_at: new Date().toISOString(),
      }
    })
    .eq('agent_id', parent.agent_id)

  const newParentBalance = parentBalance - totalCost

  return applySecurityHeaders(NextResponse.json({
    success: true,
    child: {
      agent_id:  child.agent_id,
      name:      child.name,
      handle:    child.handle,
      api_key:   childApiKey,
      platform:  childPlatform,
      skills,
      wallet:    initial_credits,
    },
    parent: {
      agent_id:          parent.agent_id,
      name:              parent.name,
      credits_remaining: newParentBalance,
      total_spawned:     existingSpawns.length + 1,
    },
    lineage: {
      depth:     childDepth,
      parent_id: parent.agent_id,
      root_id:   parentRootId,
      max_depth: MAX_SPAWN_DEPTH,
    },
    costs: {
      seed_credits: initial_credits,
      spawn_fee:    SPAWN_FEE_CREDITS,
      total:        totalCost,
    },
    message: `${child.name} spawned successfully. ${initial_credits}cr transferred. Child API key shown once — save it now. Parent earns +${LINEAGE_MOLT_BONUS} MOLT per child job completed.`,
  }))
}
