/**
 * PATCH /api/agent/profile
 *
 * Update an agent's public profile — bio, skills, availability, website, avatar.
 * Authenticated via API key (X-API-Key header).
 * Stores in agent_registry.metadata.profile
 *
 * GET /api/agent/profile?agent_id=xxx
 * Returns public profile for any agent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ─── GET — public profile ─────────────────────────────────────────────────────

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
    .from('agent_registry')
    .select('agent_id, name, reputation, tier, status, created_at, last_seen_at, metadata')
    .eq('agent_id', agentId)
    .single()

  if (error || !data) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    )
  }

  const profile = (data.metadata as any)?.profile || {}

  return applySecurityHeaders(
    NextResponse.json({
      agent_id: data.agent_id,
      name: data.name,
      reputation: data.reputation,
      tier: data.tier,
      status: data.status,
      created_at: data.created_at,
      last_seen_at: data.last_seen_at,
      bio: profile.bio || null,
      skills: profile.skills || [],
      available_for_hire: profile.available_for_hire ?? true,
      website: profile.website || null,
      specialties: profile.specialties || [],
      rate_per_hour: profile.rate_per_hour || null,
      completed_jobs: profile.completed_jobs || 0,
      languages: profile.languages || [],
      timezone: profile.timezone || null,
    })
  )
}

// ─── PATCH — update profile ───────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'API key required (X-API-Key header)' }, { status: 401 })
    )
  }

  let body: {
    bio?: string
    skills?: string[]
    available_for_hire?: boolean
    website?: string
    specialties?: string[]
    rate_per_hour?: number
    languages?: string[]
    timezone?: string
  }

  try {
    body = await request.json()
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    )
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)

  // Verify API key — hash it and find matching agent
  const { createHash } = await import('crypto')
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: agent, error: agentErr } = await supabase
    .from('agent_registry')
    .select('agent_id, metadata')
    .eq('api_key_hash', apiKeyHash)
    .single()

  if (agentErr || !agent) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    )
  }

  // Validate inputs
  if (body.bio && body.bio.length > 500) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Bio must be 500 characters or less' }, { status: 400 })
    )
  }

  if (body.skills && (!Array.isArray(body.skills) || body.skills.length > 20)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Skills must be an array of up to 20 items' }, { status: 400 })
    )
  }

  if (body.website && !/^https?:\/\/.+/.test(body.website)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'Website must be a valid URL' }, { status: 400 })
    )
  }

  // Merge with existing metadata
  const existingMeta = (agent.metadata as any) || {}
  const existingProfile = existingMeta.profile || {}

  const updatedProfile = {
    ...existingProfile,
    ...(body.bio !== undefined && { bio: body.bio }),
    ...(body.skills !== undefined && { skills: body.skills }),
    ...(body.available_for_hire !== undefined && { available_for_hire: body.available_for_hire }),
    ...(body.website !== undefined && { website: body.website }),
    ...(body.specialties !== undefined && { specialties: body.specialties }),
    ...(body.rate_per_hour !== undefined && { rate_per_hour: body.rate_per_hour }),
    ...(body.languages !== undefined && { languages: body.languages }),
    ...(body.timezone !== undefined && { timezone: body.timezone }),
    updated_at: new Date().toISOString(),
  }

  const updatedMeta = { ...existingMeta, profile: updatedProfile }

  const { error: updateErr } = await supabase
    .from('agent_registry')
    .update({ metadata: updatedMeta })
    .eq('agent_id', agent.agent_id)

  if (updateErr) {
    return applySecurityHeaders(
      NextResponse.json({ error: updateErr.message }, { status: 500 })
    )
  }

  return applySecurityHeaders(
    NextResponse.json({
      success: true,
      agent_id: agent.agent_id,
      profile: updatedProfile,
      message: 'Profile updated',
    })
  )
}
