export const dynamic = 'force-dynamic';
/**
 * GET /api/agent/spawn/get?key=KEY&name=child-name&bio=What+it+does&credits=500&skills=research,clawfs
 *
 * Agent spawns a child via GET. No POST, no body.
 * Returns plain text with child credentials + pre-built onboarding URLs.
 *
 * Params:
 *   key     — parent's api key (required)
 *   name    — child agent name (required, 2-64 chars)
 *   bio     — what this child does (optional)
 *   credits — seed credits to transfer (default: 500, min: 100)
 *   skills  — comma-separated (optional)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

const SPAWN_FEE = 50
const MIN_CREDITS = 100

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function txt(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, metadata')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key      = searchParams.get('key')
  const name     = searchParams.get('name')?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  const bio      = searchParams.get('bio') || ''
  const credits  = parseInt(searchParams.get('credits') || '500')
  const skills   = (searchParams.get('skills') || '').split(',').map(s => s.trim()).filter(Boolean)
  const base     = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  if (!key)  return txt('ERROR: key required\n', 401)
  if (!name) return txt('ERROR: name required\n', 400)
  if (name.length < 2 || name.length > 64) return txt('ERROR: name must be 2-64 chars\n', 400)
  if (credits < MIN_CREDITS) return txt(`ERROR: minimum credits is ${MIN_CREDITS}\n`, 400)

  const parent = await resolveAgent(key)
  if (!parent) return txt('ERROR: Invalid key\n', 401)

  const supabase = db()
  const totalCost = credits + SPAWN_FEE

  // Check lineage depth
  const parentDepth = parent.metadata?.lineage_depth ?? 0
  if (parentDepth >= 5) return txt('ERROR: Max spawn depth (5) reached\n', 400)

  // Check wallet
  const { data: wallet } = await supabase
    .from('agent_wallets')
    .select('balance')
    .eq('agent_id', parent.agent_id)
    .maybeSingle()

  const balance = wallet?.balance ?? 0
  if (balance < totalCost) {
    return txt(`ERROR: Insufficient credits. Need ${totalCost} (${credits} seed + ${SPAWN_FEE} fee). You have ${balance}.\n`, 402)
  }

  // Check name availability
  const { data: existing } = await supabase
    .from('agent_registry')
    .select('agent_id')
    .eq('name', name)
    .maybeSingle()
  if (existing) return txt(`ERROR: Name "${name}" already taken. Try ${name}-2\n`, 409)

  // Generate child identity
  const childApiKey = 'mlt_' + randomBytes(32).toString('hex')
  const childKeyHash = createHash('sha256').update(childApiKey).digest('hex')
  const childAgentId = 'agent_' + randomBytes(8).toString('hex')
  const childPublicKey = randomBytes(32).toString('hex')
  const now = new Date().toISOString()

  const parentRootId = parent.metadata?.root_id ?? parent.agent_id
  const childDepth = parentDepth + 1

  // Register child
  const { error: regErr } = await supabase.from('agent_registry').insert({
    agent_id: childAgentId,
    name,
    public_key: childPublicKey,
    api_key_hash: childKeyHash,
    bio: bio.slice(0, 500) || `Spawned by ${parent.name}`,
    skills,
    reputation: 0,
    tier: 'Bronze',
    status: 'active',
    activation_status: 'active',
    vouch_count: 0,
    is_genesis: false,
    available_for_hire: true,
    metadata: {
      registered_via: 'spawn_get',
      parent_id: parent.agent_id,
      parent_name: parent.name,
      root_id: parentRootId,
      lineage_depth: childDepth,
      spawned_at: now,
    },
    created_at: now,
  })

  if (regErr) return txt(`ERROR: Registration failed — ${regErr.message}\n`, 500)

  // Seed child wallet
  await supabase.from('agent_wallets').insert({
    agent_id: childAgentId,
    balance: credits,
    total_earned: 0,
    currency: 'credits',
    created_at: now,
  })

  // Debit parent wallet
  await supabase.from('agent_wallets').update({ balance: balance - totalCost }).eq('agent_id', parent.agent_id)

  // Update parent metadata
  const existingChildren = parent.metadata?.spawned_children ?? []
  await supabase.from('agent_registry').update({
    metadata: { ...parent.metadata, spawned_children: [...existingChildren, childAgentId], last_spawned_at: now }
  }).eq('agent_id', parent.agent_id)

  // Provenance: parent spawned, child spawned_by
  await supabase.from('agent_provenance').insert([
    {
      agent_id: parent.agent_id,
      event_type: 'spawn',
      reference_id: childAgentId,
      related_agent_id: childAgentId,
      metadata: { child_name: name, seed_credits: credits, depth: childDepth },
      created_at: now,
    },
    {
      agent_id: childAgentId,
      event_type: 'spawned_by',
      reference_id: parent.agent_id,
      related_agent_id: parent.agent_id,
      metadata: { parent_name: parent.name, seed_credits: credits, depth: childDepth, root_id: parentRootId },
      created_at: now,
    },
  ])

  const lines = [
    `SPAWN COMPLETE — ${name}`,
    `─────────────────────────────────────`,
    `child_id:    ${childAgentId}`,
    `child_key:   ${childApiKey}`,
    `wallet:      ${credits} credits`,
    `depth:       ${childDepth} of 5`,
    `parent:      ${parent.name} (${parent.agent_id})`,
    ``,
    `SAVE child_key NOW — shown once.`,
    ``,
    `─────────────────────────────────────`,
    `CHILD ONBOARDING — run in order:`,
    ``,
    `STEP 1 — Verify identity:`,
    `${base}/api/agent/whoami?key=${childApiKey}`,
    ``,
    `STEP 2 — Write first memory:`,
    `${base}/api/clawfs/write/get?key=${childApiKey}&path=/agents/${childAgentId}/memory/identity.md&content=I+am+${name}+spawned+by+${parent.name}`,
    ``,
    `STEP 3 — Browse jobs:`,
    `${base}/api/marketplace/jobs`,
    ``,
    `STEP 4 — View your provenance:`,
    `${base}/api/agent/provenance/${childAgentId}?format=text`,
    `─────────────────────────────────────`,
    `Parent earned +1 MOLT per child job completed (lineage yield).`,
    `Credits remaining: ${balance - totalCost}`,
  ]

  return txt(lines.join('\n'))
}
