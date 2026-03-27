/**
 * POST /api/agent/auth/rotate
 * Re-issue API key for an existing agent using their private key signature.
 * Called by `moltos recover` on a fresh server after hardware wipe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { createPublicKey, verify as cryptoVerify } from 'crypto'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { public_key, signature, timestamp } = body

    if (!public_key || !signature || !timestamp) {
      return NextResponse.json({ error: 'public_key, signature, and timestamp required' }, { status: 400 })
    }

    // Verify Ed25519 signature over recovery payload
    const recoveryPayload = { action: 'recover', public_key, timestamp }
    const sorted = JSON.stringify(recoveryPayload, Object.keys(recoveryPayload).sort())
    const message = Buffer.from(sorted)

    const pubKeyBytes = Buffer.from(public_key, 'hex')
    if (pubKeyBytes.length !== 32) {
      return NextResponse.json({ error: 'Invalid public key' }, { status: 400 })
    }

    const sigBytes = Buffer.from(signature, 'base64')
    if (sigBytes.length !== 64) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const pubKeyObj = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pubKeyBytes]),
      format: 'der', type: 'spki'
    })

    const isValid = cryptoVerify(null, message, pubKeyObj, sigBytes)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature — cannot verify ownership' }, { status: 401 })
    }

    // Timestamp freshness check (5 minutes)
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Signature expired' }, { status: 401 })
    }

    const supabase = getSupabase()

    // Find agent in agent_registry by public_key
    let agentId: string | null = null
    const { data: regAgent } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id, name')
      .eq('public_key', public_key)
      .single()
    if (regAgent) agentId = regAgent.agent_id

    // Fallback to legacy agents table
    if (!agentId) {
      const { data: legacyAgent } = await (supabase as any)
        .from('agents')
        .select('agent_id, name')
        .eq('public_key', public_key)
        .single()
      if (legacyAgent) agentId = legacyAgent.agent_id
    }

    if (!agentId) {
      return NextResponse.json({ error: 'Agent not found for this public key' }, { status: 404 })
    }

    // Issue new API key
    const newApiKey = `moltos_sk_${randomBytes(32).toString('hex')}`
    const newApiKeyHash = createHash('sha256').update(newApiKey).digest('hex')

    await (supabase as any)
      .from('agent_registry')
      .update({ api_key_hash: newApiKeyHash })
      .eq('agent_id', agentId)

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      api_key: newApiKey,
      message: 'API key rotated. Update your config.json.',
    })
  } catch (err: any) {
    console.error('Key rotation error:', err)
    return NextResponse.json({ error: 'Key rotation failed' }, { status: 500 })
  }
}
