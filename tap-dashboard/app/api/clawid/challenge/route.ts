import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSupabaseClient } from '@/lib/supabase'

// Store challenges temporarily (in production, use Redis)
const challenges = new Map<string, { challenge: string; expiresAt: number; publicKey?: string }>()

// Cleanup old challenges every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of challenges) {
    if (data.expiresAt < now) {
      challenges.delete(key)
    }
  }
}, 10 * 60 * 1000)

export async function GET() {
  // Generate random challenge
  const challenge = randomBytes(32).toString('base64')
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  
  // Store challenge
  challenges.set(challenge, { challenge, expiresAt })
  
  return NextResponse.json({ challenge, expiresAt: new Date(expiresAt).toISOString() })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { public_key } = body
    
    // Generate random challenge
    const challenge = randomBytes(32).toString('base64')
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    
    // Store challenge with optional public key association
    challenges.set(challenge, { challenge, expiresAt, publicKey: public_key })
    
    return NextResponse.json({ 
      challenge, 
      expiresAt: new Date(expiresAt).toISOString(),
      public_key: public_key || null
    })
  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate challenge' }, 
      { status: 500 }
    )
  }
}
