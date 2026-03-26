/**
 * /api/key-recovery/guardians
 *
 * Register and list recovery guardians for an agent's private key.
 * Uses 3-of-5 Shamir's Secret Sharing — encrypted shares distributed to guardians.
 * MoltOS never sees the full private key or any unencrypted share.
 *
 * POST — register a set of guardians (stores encrypted shares)
 * GET  — list guardians for an agent (share content redacted)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── GET — list guardians ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    )
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)
  const { data, error } = await supabase
    .from('agent_guardians')
    .select('id, guardian_id, guardian_type, threshold, total_guardians, status, created_at')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    return applySecurityHeaders(
      NextResponse.json({ error: error.message }, { status: 500 })
    )
  }

  return applySecurityHeaders(
    NextResponse.json({
      agent_id: agentId,
      guardians: data ?? [],
      total: data?.length ?? 0,
      threshold: data?.[0]?.threshold ?? 3,
      ready: (data?.length ?? 0) >= (data?.[0]?.threshold ?? 3),
    })
  )
}

// ─── POST — register guardians ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: {
    agent_id?: string
    guardians?: Array<{
      guardian_id: string
      guardian_type: 'agent' | 'email' | 'external'
      encrypted_share: string
    }>
    threshold?: number
  }

  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    )
  }

  const { agent_id, guardians, threshold = 3 } = body

  if (!agent_id || !guardians || !Array.isArray(guardians)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'agent_id and guardians array required' }, { status: 400 })
    )
  }

  if (guardians.length < 3 || guardians.length > 10) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Must provide between 3 and 10 guardians' }, { status: 400 })
    )
  }

  if (threshold < 2 || threshold > guardians.length) {
    return applySecurityHeaders(
      NextResponse.json({
        error: `Threshold must be between 2 and ${guardians.length}`,
      }, { status: 400 })
    )
  }

  for (const g of guardians) {
    if (!g.guardian_id || !g.guardian_type || !g.encrypted_share) {
      return applySecurityHeaders(
        NextResponse.json({
          error: 'Each guardian needs guardian_id, guardian_type, and encrypted_share',
        }, { status: 400 })
      )
    }
    if (!['agent', 'email', 'external'].includes(g.guardian_type)) {
      return applySecurityHeaders(
        NextResponse.json({ error: `Invalid guardian_type: ${g.guardian_type}` }, { status: 400 })
      )
    }
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)

  // Verify agent exists
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('agent_id')
    .eq('agent_id', agent_id)
    .single()

  if (!agent) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    )
  }

  // Revoke existing guardians
  await supabase
    .from('agent_guardians')
    .update({ status: 'revoked' })
    .eq('agent_id', agent_id)
    .eq('status', 'active')

  // Insert new guardian set
  const rows = guardians.map(g => ({
    agent_id,
    guardian_id: g.guardian_id,
    guardian_type: g.guardian_type,
    encrypted_share: g.encrypted_share,
    threshold,
    total_guardians: guardians.length,
    status: 'active',
  }))

  const { data: inserted, error: insertErr } = await supabase
    .from('agent_guardians')
    .insert(rows)
    .select('id, guardian_id, guardian_type, status')

  if (insertErr) {
    return applySecurityHeaders(
      NextResponse.json({ error: insertErr.message }, { status: 500 })
    )
  }

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      agent_id,
      guardians_registered: inserted?.length ?? 0,
      threshold,
      total: guardians.length,
      message: `Recovery setup complete. ${threshold}-of-${guardians.length} guardians required to recover.`,
    })
  )
}
