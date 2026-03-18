import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/lib/supabase'

// Store challenges temporarily (in production, use Redis)
const challenges = new Map<string, { challenge: string; expiresAt: number }>()

export async function GET() {
  // Generate random challenge
  const challenge = randomBytes(32).toString('base64')
  const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  
  // Store challenge
  challenges.set(challenge, { challenge, expiresAt })
  
  // Clean up old challenges
  for (const [key, data] of challenges) {
    if (data.expiresAt < Date.now()) {
      challenges.delete(key)
    }
  }
  
  return NextResponse.json({ challenge, expiresAt })
}
