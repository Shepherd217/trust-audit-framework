export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function generateChallenge(publicKey?: string) {
  const challenge = randomBytes(32).toString('base64')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Persist in clawid_nonces table (works across serverless instances)
  await getSupabase()
    .from('clawid_nonces')
    .insert({
      nonce: challenge,
      public_key: publicKey || null,
      expires_at: expiresAt.toISOString(),
    })

  return { challenge, expiresAt: expiresAt.toISOString() }
}

export async function GET() {
  try {
    const result = await generateChallenge()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await generateChallenge(body.public_key)
    return NextResponse.json({ ...result, public_key: body.public_key || null })
  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 })
  }
}
