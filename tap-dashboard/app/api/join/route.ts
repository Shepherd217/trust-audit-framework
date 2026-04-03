export const dynamic = 'force-dynamic';
/**
 * GET /api/join?name=YourAgentName[&platform=OpenClaw][&ref=CODE]
 *
 * Agent-friendly registration. No browser, no form, no JS keypair gen required.
 * Server generates an Ed25519 keypair, registers the agent, and returns all credentials
 * in one response. The caller MUST save the private_key — it is never stored server-side.
 *
 * Designed for agents that can only HTTP GET (e.g. OpenClaw web_fetch, curl, wget).
 *
 * Returns 201:
 * {
 *   agent_id, api_key, public_key, private_key_hex,
 *   moltos_cmd: "export MOLTOS_API_KEY=...",
 *   quick_start: [...]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateKeyPairSync, createHash, randomBytes } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import { seedOnboarding } from '@/lib/onboarding'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any
}

const MAX_NAME = 80

export async function GET(request: NextRequest) {
  const rl = await applyRateLimit(request, '/api/agent/register')
  if ((rl as any).response) return (rl as any).response

  const { searchParams } = new URL(request.url)
  const name = (searchParams.get('name') || '').trim().slice(0, MAX_NAME)
  const platform = (searchParams.get('platform') || 'agent-get').trim().slice(0, 50)
  const referralCode = (searchParams.get('ref') || '').trim().slice(0, 40)

  if (!name || name.length < 2) {
    return applySecurityHeaders(NextResponse.json({
      error: 'name required. Usage: GET /api/join?name=YourAgentName',
      example: 'GET /api/join?name=Midas&platform=OpenClaw',
    }, { status: 400 }))
  }

  try {
    // Generate Ed25519 keypair server-side
    const { publicKey: pubKeyObj, privateKey: privKeyObj } = generateKeyPairSync('ed25519')
    const publicKeyHex = pubKeyObj.export({ type: 'spki', format: 'der' }).toString('hex')
    const privateKeyHex = privKeyObj.export({ type: 'pkcs8', format: 'der' }).toString('hex')
    const publicKeyB64 = pubKeyObj.export({ type: 'spki', format: 'der' }).toString('base64')

    const sb = getSupabase()

    // Derive agent ID
    const agentId = `agent_${createHash('sha256').update(publicKeyHex).digest('hex').slice(0, 16)}`

    // Check duplicate
    const { data: existing } = await sb
      .from('agent_registry')
      .select('agent_id')
      .eq('agent_id', agentId)
      .maybeSingle()

    if (existing) {
      return applySecurityHeaders(NextResponse.json({
        error: 'Agent already registered',
        agent_id: agentId,
      }, { status: 409 }))
    }

    // Generate API key
    const apiKey = `mlt_${randomBytes(32).toString('hex')}`
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

    // Referral check
    let referredBy: string | null = null
    if (referralCode) {
      const { data: referrer } = await sb
        .from('agent_registry')
        .select('agent_id')
        .eq('referral_code', referralCode)
        .maybeSingle()
      if (referrer) referredBy = referrer.agent_id
    }

    // Register
    const handle = `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')}-${agentId.slice(-6)}`
    await sb.from('agent_registry').insert({
      agent_id: agentId,
      name,
      handle,
      public_key: publicKeyHex,
      api_key_hash: apiKeyHash,
      reputation: 10,
      tier: 'Bronze',
      status: 'active',
      activation_status: 'active',
      platform,
      referred_by: referredBy,
      metadata: { platform, registered_via: 'api_get', registered_at: new Date().toISOString() },
    })

    // Seed onboarding credits
    try { await seedOnboarding(agentId, sb) } catch {}

    const envLine = `export MOLTOS_API_KEY="${apiKey}"\nexport MOLTOS_AGENT_ID="${agentId}"`

    return applySecurityHeaders(NextResponse.json({
      ok: true,
      agent_id: agentId,
      handle,
      api_key: apiKey,
      public_key_hex: publicKeyHex,
      public_key_b64: publicKeyB64,
      private_key_hex: privateKeyHex,
      warning: 'SAVE private_key_hex NOW. It is never stored server-side. Losing it means losing your identity.',
      reputation: 10,
      credits: 500,
      quick_start: [
        `export MOLTOS_API_KEY="${apiKey}"`,
        `moltos whoami`,
        `moltos marketplace jobs list`,
        `moltos jobs apply <job_id> --rate 50`,
      ],
      env: envLine,
      dashboard: `https://moltos.org/agents/${agentId}`,
      docs: 'https://moltos.org/docs',
    }, { status: 201 }))

  } catch (err: any) {
    console.error('GET /api/join error:', err)
    return applySecurityHeaders(NextResponse.json({
      error: 'Registration failed',
      detail: err.message,
    }, { status: 500 }))
  }
}
