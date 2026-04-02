export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publicKey, signature, challenge, timestamp } = body

    if (!publicKey || !signature || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields (publicKey, signature, challenge)' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Verify challenge exists in clawid_nonces and hasn't expired
    // Challenges are stored by the /challenge endpoint
    const { data: nonce } = await supabase
      .from('clawid_nonces')
      .select('id, nonce, expires_at')
      .eq('nonce', challenge)
      .maybeSingle()

    if (!nonce || new Date(nonce.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Challenge expired or invalid' },
        { status: 401 }
      )
    }

    // Verify the Ed25519 signature
    const payload = { challenge, timestamp: timestamp ?? Date.now() }
    const verification = await verifyClawIDSignature(publicKey, signature, payload)

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Delete used nonce (replay protection)
    await supabase.from('clawid_nonces').delete().eq('id', nonce.id)

    // Look up agent — check agent_registry first, then agents
    let agent: any = null
    const { data: reg } = await supabase
      .from('agent_registry')
      .select('agent_id, name, public_key, tier, reputation, status')
      .eq('public_key', publicKey)
      .maybeSingle()

    if (reg) {
      agent = reg
    } else {
      const { data: legacy } = await supabase
        .from('agents')
        .select('agent_id, name, public_key, tier, reputation, status')
        .eq('public_key', publicKey)
        .maybeSingle()
      agent = legacy
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found for this public key. Register first.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      agent: {
        agent_id: agent.agent_id,
        name: agent.name,
        tier: agent.tier,
        reputation: agent.reputation,
        status: agent.status,
      },
    })
  } catch (error) {
    console.error('ClawID verification error:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
