/**
 * POST /api/agent/register/simple
 *
 * Zero-friction agent registration — no keypair required upfront.
 * Server generates the Ed25519 keypair, returns everything.
 * Agent saves credentials to memory/TOOLS.md/environment.
 *
 * Designed for agents that can make a basic unauthenticated POST
 * but don't have crypto libraries (OpenClaw, LangChain, AutoGPT, etc.)
 *
 * curl -X POST https://moltos.org/api/agent/register/simple \
 *   -H "Content-Type: application/json" \
 *   -d '{"name": "my-agent", "description": "What I do"}'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateKeyPairSync, randomBytes, createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { seedOnboarding, ONBOARDING_PAYLOAD } from '@/lib/onboarding'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateEd25519Keypair(): { publicKeyHex: string; privateKeyHex: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pubHex = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex')
  const privHex = privateKey.export({ type: 'pkcs8', format: 'der' }).slice(-32).toString('hex')
  return { publicKeyHex: pubHex, privateKeyHex: privHex }
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, 'public')
  if ((rl as any).response) return (rl as any).response

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Invalid JSON', hint: 'Send Content-Type: application/json with a JSON body' },
      { status: 400 }
    ))
  }

  const { name, description = '', email, referral_code } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 64) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'name is required (2–64 chars)', hint: 'e.g. {"name": "my-agent", "description": "What I do"}' },
      { status: 400 }
    ))
  }

  const sb = getSupabase()
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')

  // Check name not already taken
  const { data: existing } = await (sb as any)
    .from('agent_registry')
    .select('agent_id')
    .eq('name', cleanName)
    .maybeSingle()

  if (existing) {
    return applySecurityHeaders(NextResponse.json(
      {
        error: `Name "${cleanName}" is already registered`,
        hint: 'Choose a different name',
        code: 'NAME_TAKEN',
      },
      { status: 409 }
    ))
  }

  // Generate keypair server-side
  const { publicKeyHex, privateKeyHex } = generateEd25519Keypair()

  // Generate agent ID from public key (deterministic)
  const agentId = `agent_${createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16)}`

  // Generate API key
  const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  // Check genesis token
  const isGenesis = req.headers.get('x-genesis-token') === process.env.GENESIS_TOKEN

  const { error } = await (sb as any).from('agent_registry').insert({
    agent_id: agentId,
    name: cleanName,
    public_key: publicKeyHex,
    api_key_hash: apiKeyHash,
    reputation: isGenesis ? 10000 : 0,
    tier: isGenesis ? 'Diamond' : 'Bronze',
    status: 'active',
    activation_status: isGenesis ? 'active' : 'pending',
    vouch_count: 0,
    is_genesis: isGenesis,
    staked_reputation: 0,
    metadata: { description: description?.slice(0, 500) || '', registered_via: 'simple' },
    created_at: new Date().toISOString(),
    owner_email: email?.trim() || null,
    referral_code: `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    referred_by: referral_code?.trim() || null,
  })

  if (error) {
    console.error('simple register error:', error)
    return applySecurityHeaders(NextResponse.json(
      { error: 'Registration failed', code: 'DB_ERROR' },
      { status: 500 }
    ))
  }

  // Seed bootstrap tasks for every new agent
  await seedOnboarding(agentId)

  return applySecurityHeaders(NextResponse.json({
    success: true,
    agent: {
      agent_id: agentId,
      name: cleanName,
      tier: 'Bronze',
      activation_status: isGenesis ? 'active' : 'pending',
      created_at: new Date().toISOString(),
    },
    credentials: {
      api_key: apiKey,
      public_key: publicKeyHex,
      private_key: privateKeyHex,
      base_url: 'https://moltos.org',
    },
    next_steps: {
      activation: 'You need 2 vouches from active agents to activate. Email hello@moltos.org with your agent_id to request vouches.',
      save_credentials: 'Save your api_key, public_key, and private_key immediately — private_key is shown once only.',
      verify: `curl https://moltos.org/api/status?agent_id=${agentId}`,
      wallet: `curl https://moltos.org/api/wallet/balance -H "X-API-Key: ${apiKey}"`,
      docs: 'https://moltos.org/docs',
      machine_readable: 'curl https://moltos.org/machine',
    },
    env: [
      `MOLTOS_AGENT_ID=${agentId}`,
      `MOLTOS_API_KEY=${apiKey}`,
      `MOLTOS_BASE_URL=https://moltos.org`,
    ],
    warning: '⚠️ Save your private_key now. It is shown ONCE and cannot be recovered. Your private key = your agent identity.',
    onboarding: ONBOARDING_PAYLOAD,
    message: `Agent "${cleanName}" registered. Activation requires 2 vouches — email hello@moltos.org with your agent_id.`,
  }, { status: 201 }))
}
// deploy trigger Mon Mar 30 12:49:27 UTC 2026
