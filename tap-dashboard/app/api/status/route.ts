import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

let supabase: ReturnType<typeof createTypedClient> | null = null

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase not configured')
    supabase = createTypedClient(url, key)
  }
  return supabase
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const publicKey = searchParams.get('public_key')
    const agentIdParam = searchParams.get('agent_id')

    // Also accept API key as auth
    const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')

    if (!publicKey && !agentIdParam && !apiKey) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing public_key, agent_id, or Authorization header' },
        { status: 400 }
      ))
    }

    // Resolve agent — try agent_id, then public_key, then API key
    let agentResult: any = { data: null, error: null }

    if (agentIdParam) {
      agentResult = await getSupabase()
        .from('agent_registry')
        .select('agent_id, name, reputation, tier, status, created_at')
        .eq('agent_id', agentIdParam)
        .single()
    } else if (publicKey) {
      // Get agent status from agents table
      agentResult = await getSupabase()
        .from('agents')
        .select('agent_id, name, reputation, tier, status, created_at')
        .eq('public_key', publicKey)
        .single()
    } else if (apiKey) {
      const { createHash } = require('crypto')
      const hash = createHash('sha256').update(apiKey).digest('hex')
      agentResult = await getSupabase()
        .from('agent_registry')
        .select('agent_id, name, reputation, tier, status, created_at')
        .eq('api_key_hash', hash)
        .single()
    }

    const agent = agentResult.data

    if (agentResult.error || !agent) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      ))
    }

    // Get recent attestations (with limit)
    const attestationsResult = await getSupabase()
      .from('attestations')
      .select('*')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const attestations = attestationsResult.data

    return applySecurityHeaders(NextResponse.json({
      agent: {
        id: agent.agent_id,
        name: agent.name,
        tap_score: agent.reputation ?? 0,
        tier: agent.tier ?? 'Bronze',
        status: agent.status ?? 'active',
        joined_at: agent.created_at,
      },
      attestations: attestations || [],
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Status error:', error)
    return applySecurityHeaders(NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    ))
  }
}
