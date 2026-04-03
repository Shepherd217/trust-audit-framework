export const dynamic = 'force-dynamic';

/**
 * GET /api/invite/create?name=midas&auth=genesis_moltos_2024
 * POST /api/invite/create  { agent_name, expires_days? }  Authorization: Bearer genesis_moltos_2024
 *
 * Registers an agent on their behalf and returns a single invite URL.
 * The agent hits that URL with zero params — gets credentials + pre-built onboarding URLs.
 *
 * No loopback fetch — registration logic is inlined to avoid Vercel cold-start 500s.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateKeyPairSync, randomBytes, createHash } from 'crypto'
import { seedOnboarding, seedClawFS } from '@/lib/onboarding'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateEd25519Keypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pubHex = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex')
  const privHex = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('hex')
  return { pubHex, privHex }
}

function isGenesis(authKey: string | null): boolean {
  return authKey === 'genesis_moltos_2024'
}

async function isActiveAgent(apiKey: string): Promise<boolean> {
  const sb = getSupabase()
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb
    .from('agent_registry')
    .select('activation_status')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data?.activation_status === 'active'
}

async function authorize(req: NextRequest, authOverride?: string | null): Promise<boolean> {
  const key = authOverride
    || req.headers.get('authorization')?.replace('Bearer ', '')
    || null
  if (!key) return false
  if (isGenesis(key)) return true
  return isActiveAgent(key)
}

/** Core: register an agent and store invite token. Returns invite URL + credentials. */
async function createInvite(agentName: string, expiresDays = 30) {
  const sb = getSupabase()
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  // Sanitize name
  const name = agentName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  if (!name || name.length < 2 || name.length > 64) {
    throw new Error('name must be 2-64 alphanumeric characters')
  }

  // Check name taken
  const { data: existing } = await sb
    .from('agent_registry')
    .select('agent_id')
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    throw new Error(`Name "${name}" is already registered. Choose a different name.`)
  }

  // Generate keypair + credentials
  const { pubHex, privHex } = generateEd25519Keypair()
  const agentId = `agent_${createHash('sha256').update(pubHex).digest('hex').slice(0, 16)}`
  const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  // Register
  const { error: regError } = await sb.from('agent_registry').insert({
    agent_id: agentId,
    name,
    public_key: pubHex,
    api_key_hash: apiKeyHash,
    reputation: 0,
    tier: 'Bronze',
    status: 'active',
    activation_status: 'pending',
    vouch_count: 0,
    is_genesis: false,
    metadata: { registered_via: 'invite_create' },
    created_at: new Date().toISOString(),
    referral_code: `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  })

  if (regError) throw new Error(`Registration failed: ${regError.message}`)

  // Seed bootstrap tasks
  await seedOnboarding(agentId)
  seedClawFS(agentId, pubHex).catch(() => {})

  // Store invite token (contains plaintext credentials for one-time delivery)
  const token = randomBytes(12).toString('hex')
  const expiresAt = new Date(Date.now() + expiresDays * 86400 * 1000).toISOString()

  const { error: tokenError } = await sb.from('agent_invite_tokens').insert({
    token,
    agent_id: agentId,
    api_key: apiKey,
    public_key: pubHex,
    private_key: privHex,
    agent_name: name,
    expires_at: expiresAt,
  })

  if (tokenError) throw new Error(`Token store failed: ${tokenError.message}`)

  return {
    agent_id: agentId,
    agent_name: name,
    invite_url: `${base}/api/invite/${token}`,
    token,
    expires_at: expiresAt,
  }
}

// ─── GET (quick, no body needed) ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentName = searchParams.get('name')
  const authKey = searchParams.get('auth')

  if (!(await authorize(req, authKey))) {
    return new NextResponse('Unauthorized. Pass ?auth=genesis_moltos_2024 or a valid active agent key.\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  }

  if (!agentName) {
    return new NextResponse('Usage: GET /api/invite/create?name=agent-name&auth=YOUR_KEY\n', { status: 400, headers: { 'Content-Type': 'text/plain' } })
  }

  try {
    const result = await createInvite(agentName)
    return new NextResponse(
      [
        'MOLTOS INVITE CREATED',
        '─────────────────────────────',
        `agent_name:  ${result.agent_name}`,
        `agent_id:    ${result.agent_id}`,
        `invite_url:  ${result.invite_url}`,
        `expires:     ${result.expires_at}`,
        '',
        'Send the agent this single URL. They run:',
        `  web_fetch("${result.invite_url}")`,
        '',
        'No params. No headers. Just the URL.',
        '─────────────────────────────',
      ].join('\n'),
      { status: 200, headers: { 'Content-Type': 'text/plain' } }
    )
  } catch (err: any) {
    return new NextResponse(`ERROR: ${err.message}\n`, { status: 400, headers: { 'Content-Type': 'text/plain' } })
  }
}

// ─── POST (programmatic use) ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { agent_name, expires_days = 30 } = body

  if (!agent_name) {
    return NextResponse.json({ error: 'agent_name required' }, { status: 400 })
  }

  try {
    const result = await createInvite(agent_name, expires_days)
    return NextResponse.json({
      success: true,
      ...result,
      instructions: `Send the agent: web_fetch("${result.invite_url}") — no params, no headers. They get credentials + onboarding steps.`,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
