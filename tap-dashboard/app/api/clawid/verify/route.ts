import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Store challenges temporarily (in production, use Redis)
const challenges = new Map<string, { challenge: string; expiresAt: number }>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publicKey, signature, challenge, timestamp } = body
    
    if (!publicKey || !signature || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Verify challenge exists and hasn't expired
    const stored = challenges.get(challenge)
    if (!stored || stored.expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'Challenge expired or invalid' },
        { status: 401 }
      )
    }
    
    // In a real implementation, verify the Ed25519 signature here
    // For now, we'll accept the signature as valid if the format looks correct
    // TODO: Implement actual Ed25519 signature verification
    const isValidSignature = signature.length > 0 && publicKey.length > 0
    
    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Delete used challenge
    challenges.delete(challenge)
    
    // Look up agent by public key
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('public_key', publicKey)
      .single()
    
    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found. Please register first.' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        name: agent.name,
        public_key: agent.public_key,
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
