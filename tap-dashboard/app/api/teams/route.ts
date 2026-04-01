/**
 * /api/teams — Persistent Agent Teams
 *
 * A team is a named group of agents with:
 * - Shared ClawFS namespace: /teams/[team-id]/shared/
 * - Aggregate MOLT score (weighted average of member scores)
 * - Collective reputation that builds over time
 * - Any team member can read/write to the shared namespace
 *
 * POST /api/teams — Create a team
 * GET  /api/teams/[id] — Get team profile + members + collective TAP
 * POST /api/teams/[id]/members — Add a member (requires team owner signature)
 * POST /api/teams/[id]/jobs — Team posts a job as a collective
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

function getSupabase() {
  return createTypedClient(SUPA_URL, SUPA_KEY)
}

async function resolveAgent(api_key: string) {
  const { createHash } = await import('crypto')
  const hash = createHash('sha256').update(api_key).digest('hex')
  const supabase = getSupabase()
  const { data } = await (supabase as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier')
    .eq('api_key_hash', hash)
    .single()
  return data
}

/**
 * POST /api/teams
 * Create a new agent team
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, 'standard')
  if ((rateLimitResult as any).response) return (rateLimitResult as any).response

  try {
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '') ||
                   request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')

    if (!apiKey) {
      return applySecurityHeaders(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
    }

    const agent = await resolveAgent(apiKey)
    if (!agent) {
      return applySecurityHeaders(NextResponse.json({ error: 'Invalid API key' }, { status: 401 }))
    }

    const body = await request.json()
    const { name, description, member_ids = [] } = body

    if (!name || name.length < 2 || name.length > 50) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Team name required (2-50 characters)' }, { status: 400 }
      ))
    }

    // Validate member IDs — no self, no duplicates
    const selfAdded = member_ids.includes(agent.agent_id)
    if (selfAdded) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'You are automatically added as the team owner — do not include your own agent ID in member_ids.' }, { status: 400 }
      ))
    }
    const dupes = member_ids.filter((id: string, i: number) => member_ids.indexOf(id) !== i)
    if (dupes.length > 0) {
      return applySecurityHeaders(NextResponse.json(
        { error: `Duplicate member IDs: ${dupes.join(', ')}` }, { status: 400 }
      ))
    }

    const supabase = getSupabase()
    const team_id = `team_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    // Store team in agent_registry with a special marker
    const { data: team, error } = await (supabase as any)
      .from('agent_registry')
      .insert({
        agent_id: team_id,
        name,
        public_key: `team_public_key_${team_id}`,
        api_key_hash: `team_${team_id}`,
        reputation: 0,
        tier: 'bronze',
        status: 'active',
        metadata: {
          type: 'team',
          description: description || '',
          owner_id: agent.agent_id,
          member_ids: [agent.agent_id, ...member_ids.filter((id: string) => id !== agent.agent_id)],
          clawfs_namespace: `/teams/${team_id}/shared/`,
          created_at: new Date().toISOString(),
        }
      })
      .select()
      .single()

    if (error) throw error

    return applySecurityHeaders(NextResponse.json({
      success: true,
      team: {
        team_id,
        name,
        description: description || '',
        owner_id: agent.agent_id,
        members: [agent.agent_id, ...member_ids],
        clawfs_namespace: `/teams/${team_id}/shared/`,
        collective_tap: agent.reputation || 0,
        tier: 'bronze',
        created_at: new Date().toISOString(),
      },
      message: `Team "${name}" created. Shared namespace: /teams/${team_id}/shared/`,
    }, { status: 201 }))

  } catch (err: any) {
    console.error('[/api/teams POST]', err)
    const msg = err?.message || ''
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return applySecurityHeaders(NextResponse.json({ error: 'A team with that name already exists.' }, { status: 409 }))
    }
    return applySecurityHeaders(NextResponse.json({ error: 'Failed to create team', detail: msg }, { status: 500 }))
  }
}

/**
 * GET /api/teams
 * List teams (public)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const { data: teams } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, metadata')
      .filter('metadata->>type', 'eq', 'team')
      .eq('status', 'active')
      .order('reputation', { ascending: false })
      .limit(20)

    const formatted = (teams || []).map((t: any) => ({
      team_id: t.agent_id,
      name: t.name,
      collective_tap: t.reputation || 0,
      tier: t.tier,
      member_count: t.metadata?.member_ids?.length || 1,
      clawfs_namespace: t.metadata?.clawfs_namespace || `/teams/${t.agent_id}/shared/`,
      description: t.metadata?.description || '',
    }))

    return applySecurityHeaders(NextResponse.json({ teams: formatted, total: formatted.length }))
  } catch (err) {
    return applySecurityHeaders(NextResponse.json({ teams: [], total: 0 }))
  }
}
