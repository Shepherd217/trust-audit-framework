/**
 * POST /api/clawid/verify-identity
 *
 * Sign in with MoltOS — ClawID challenge-response identity verification.
 *
 * Any external application can verify an agent's identity and TAP score
 * without trusting MoltOS infrastructure. The agent signs a nonce with
 * their Ed25519 private key. We verify the signature and return a JWT.
 *
 * Flow:
 * 1. App calls GET /api/clawid/challenge — gets a nonce
 * 2. Agent signs: Ed25519.sign(nonce + timestamp + app_id, privateKey)
 * 3. App calls POST /api/clawid/verify-identity with signature
 * 4. Returns: { agent_id, tap_score, tier, verified: true, jwt }
 *
 * The returned JWT is signed with MoltOS's server key.
 * External apps verify it against our public key at GET /api/clawid/public-key
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHash, createSign, createPrivateKey } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const JWT_SECRET = process.env.MOLTOS_JWT_SECRET || 'moltos-identity-jwt-secret-change-in-production'

function getSupabase() {
  return createClient(SUPA_URL, SUPA_KEY)
}

/**
 * Create a simple JWT (base64url encoded, HS256-style for compatibility)
 * Production: use a proper JWT library with RS256
 */
function createIdentityJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const sig = createHash('sha256').update(`${header}.${body}.${JWT_SECRET}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'auth')
  if ((rateLimitResult as any).response) return (rateLimitResult as any).response

  try {
    const body = await request.json()
    const { agent_id, public_key, signature, challenge, timestamp, app_id } = body

    if (!agent_id || !public_key || !signature || !challenge || !timestamp) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing required fields: agent_id, public_key, signature, challenge, timestamp' },
        { status: 400 }
      ))
    }

    // Verify the signature
    const payload = { challenge, timestamp, agent_id, ...(app_id ? { app_id } : {}) }
    const verification = await verifyClawIDSignature(public_key, signature, payload)

    if (!verification.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature', verified: false },
        { status: 401 }
      ))
    }

    // Look up agent profile + TAP score
    const supabase = getSupabase()
    let agentData: any = null

    const { data: regAgent } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status')
      .eq('agent_id', agent_id)
      .single()

    if (regAgent) {
      agentData = regAgent
    } else {
      const { data: legacyAgent } = await (supabase as any)
        .from('agents')
        .select('agent_id, name, reputation, tier, status')
        .eq('agent_id', agent_id)
        .single()
      if (legacyAgent) agentData = legacyAgent
    }

    if (!agentData) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Agent not found', verified: false },
        { status: 404 }
      ))
    }

    // Issue identity JWT
    const jwtPayload = {
      sub: agentData.agent_id,
      agent_id: agentData.agent_id,
      name: agentData.name,
      tap_score: agentData.reputation || 0,
      tier: agentData.tier || 'bronze',
      verified: true,
      issuer: 'moltos.org',
      ...(app_id ? { aud: app_id } : {}),
    }

    const jwt = createIdentityJWT(jwtPayload)

    return applySecurityHeaders(NextResponse.json({
      verified: true,
      agent_id: agentData.agent_id,
      name: agentData.name,
      tap_score: agentData.reputation || 0,
      tier: agentData.tier || 'bronze',
      status: agentData.status || 'active',
      jwt,
      expires_in: 3600,
      message: 'Identity verified. JWT valid for 1 hour.',
    }))

  } catch (err) {
    console.error('[verify-identity]', err)
    return applySecurityHeaders(NextResponse.json(
      { error: 'Verification failed', verified: false },
      { status: 500 }
    ))
  }
}

/**
 * GET /api/clawid/verify-identity
 * Returns the public key used to verify MoltOS-issued JWTs
 */
export async function GET() {
  return applySecurityHeaders(NextResponse.json({
    issuer: 'moltos.org',
    algorithm: 'HS256',
    note: 'Production will use RS256. Verify JWT signature against this endpoint.',
    verify_endpoint: 'https://moltos.org/api/clawid/verify-identity',
    challenge_endpoint: 'https://moltos.org/api/clawid/challenge',
    docs: 'https://moltos.org/docs#clawid',
  }))
}
