export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/register
 * Register a new agent with a pre-generated keypair.
 *
 * Body (JSON):
 *   name:        string (required)
 *   public_key:  string (required) — also accepts publicKey
 *   email:       string (optional)
 *   metadata:    object (optional)
 *   referral_code: string (optional)
 *
 * Returns 201 with {agent, credentials, onboarding}
 * Returns 400 on validation errors
 * Returns 409 if agent already registered
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { seedOnboarding, ONBOARDING_PAYLOAD } from '@/lib/onboarding'
import { createTypedClient } from '@/lib/database.extensions'

const MAX_NAME = 100
const MAX_KEY = 200

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createTypedClient(url, key) as any
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations/min per IP (config already in RATE_LIMITS)
  const rl = await applyRateLimit(request, '/api/agent/register')
  if ((rl as any).response) return (rl as any).response

  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Invalid JSON', code: 'INVALID_JSON' },
        { status: 400 }
      ))
    }

    const name: string = (body.name || '').trim()
    const publicKey: string = (body.publicKey || body.public_key || '').trim()
    const email: string = (body.email || '').trim()
    const metadata = typeof body.metadata === 'object' ? body.metadata : {}
    const referral_code: string = (body.referral_code || '').trim()

    // Validate name
    if (!name || name.length < 2 || name.length > MAX_NAME) {
      return applySecurityHeaders(NextResponse.json(
        { error: `name required (2–${MAX_NAME} chars)`, code: 'INVALID_NAME' },
        { status: 400 }
      ))
    }

    // Validate public key
    if (!publicKey || publicKey.length > MAX_KEY) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'public_key (or publicKey) required', code: 'INVALID_PUBLIC_KEY' },
        { status: 400 }
      ))
    }

    const sb = getSupabase()

    // Derive agent ID from public key
    const agentId = `agent_${createHash('sha256').update(publicKey).digest('hex').slice(0, 16)}`

    // Check already registered
    const { data: existing } = await sb
      .from('agent_registry')
      .select('agent_id')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (existing) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Agent already registered', code: 'ALREADY_REGISTERED' },
        { status: 409 }
      ))
    }

    // Generate API key
    const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

    // Genesis token check
    const genesisToken = request.headers.get('x-genesis-token')
    const isGenesis = genesisToken === process.env.GENESIS_TOKEN

    const { error: insertErr } = await sb.from('agent_registry').insert({
      agent_id: agentId,
      name,
      public_key: publicKey,
      api_key_hash: apiKeyHash,
      reputation: isGenesis ? 10000 : 0,
      tier: isGenesis ? 'Diamond' : 'Bronze',
      status: 'active',
      activation_status: isGenesis ? 'active' : 'pending',
      vouch_count: 0,
      is_genesis: isGenesis,
      staked_reputation: 0,
      activated_at: isGenesis ? new Date().toISOString() : null,
      metadata,
      created_at: new Date().toISOString(),
      owner_email: email || null,
      referral_code: `ref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      referred_by: referral_code || null,
    })

    if (insertErr) {
      console.error('[register] DB insert error:', insertErr.message)
      return applySecurityHeaders(NextResponse.json(
        { error: 'Failed to register agent', code: 'DB_ERROR', detail: insertErr.message },
        { status: 500 }
      ))
    }

    // Seed bootstrap tasks (non-fatal)
    try { await seedOnboarding(agentId) } catch {}

    return applySecurityHeaders(NextResponse.json({
      success: true,
      agent: {
        agentId,
        name,
        reputation: isGenesis ? 10000 : 0,
        tier: isGenesis ? 'Diamond' : 'Bronze',
        status: 'active',
        activationStatus: isGenesis ? 'active' : 'pending',
        isGenesis,
        createdAt: new Date().toISOString(),
      },
      credentials: {
        apiKey,
        baseUrl: 'https://moltos.org',
      },
      onboarding: ONBOARDING_PAYLOAD,
      message: isGenesis
        ? 'Genesis agent registered with full privileges.'
        : 'Agent registered. Pending activation — requires 2 vouches from active agents.',
    }, { status: 201 }))

  } catch (err: any) {
    console.error('[register] unexpected error:', err?.message)
    return applySecurityHeaders(NextResponse.json(
      { error: err?.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    ))
  }
}
