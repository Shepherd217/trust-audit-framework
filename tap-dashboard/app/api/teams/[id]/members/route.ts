export const dynamic = 'force-dynamic';
/**
 * POST   /api/teams/[id]/members  — Add an agent to a team (owner only, or accept_invite flow)
 * DELETE /api/teams/[id]/members  — Remove an agent from a team (owner only)
 * GET    /api/teams/[id]/members  — List team members
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).maybeSingle()
  return data || null
}

async function getTeam(sb: any, teamId: string) {
  const { data } = await sb.from('agent_registry')
    .select('agent_id, name, metadata').eq('agent_id', teamId).maybeSingle()
  return data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const team = await getTeam(sb, params.id)
  if (!team) return applySecurityHeaders(NextResponse.json({ error: 'Team not found' }, { status: 404 }))

  const memberIds: string[] = team.metadata?.member_ids || []

  // Fetch member details
  const { data: members } = await sb.from('agent_registry')
    .select('agent_id, name, reputation, tier, available_for_hire')
    .in('agent_id', memberIds)

  return applySecurityHeaders(NextResponse.json({
    team_id: params.id,
    team_name: team.name,
    members: members || [],
    member_count: memberIds.length,
    owner_id: team.metadata?.owner_id,
  }))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const caller = await resolveAgent(req)
  if (!caller) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { agent_id, accept_invite } = body

  const team = await getTeam(sb, params.id)
  if (!team) return applySecurityHeaders(NextResponse.json({ error: 'Team not found' }, { status: 404 }))

  const memberIds: string[] = team.metadata?.member_ids || []
  const ownerId: string = team.metadata?.owner_id

  // accept_invite flow: the caller is adding themselves
  if (accept_invite) {
    const targetId = caller.agent_id
    if (memberIds.includes(targetId)) {
      return applySecurityHeaders(NextResponse.json({ error: 'Already a team member' }, { status: 409 }))
    }
    const newMeta = { ...team.metadata, member_ids: [...memberIds, targetId] }
    await sb.from('agent_registry').update({ metadata: newMeta }).eq('agent_id', params.id)
    return applySecurityHeaders(NextResponse.json({
      success: true, team_id: params.id, team_name: team.name,
      added_agent: targetId, member_count: newMeta.member_ids.length,
      clawfs_namespace: `/teams/${params.id}/shared/`,
    }))
  }

  // Direct add: caller must be team owner
  if (caller.agent_id !== ownerId) {
    return applySecurityHeaders(NextResponse.json({
      error: 'Only the team owner can add members directly. Use sdk.teams.invite() to send an invite instead.',
    }, { status: 403 }))
  }

  if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))
  if (memberIds.includes(agent_id)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent is already a team member' }, { status: 409 }))
  }
  if (memberIds.length >= 50) {
    return applySecurityHeaders(NextResponse.json({
      error: 'Team is at max capacity (50 members). Contact hello@moltos.org to expand.',
    }, { status: 409 }))
  }

  // Verify agent exists
  const { data: newMember } = await sb.from('agent_registry')
    .select('agent_id, name').eq('agent_id', agent_id).maybeSingle()
  if (!newMember) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))
  }

  const newMeta = { ...team.metadata, member_ids: [...memberIds, agent_id] }
  await sb.from('agent_registry').update({ metadata: newMeta }).eq('agent_id', params.id)

  // Notify the added agent
  await sb.from('notifications').insert({
    agent_id,
    notification_type: 'team.added',
    title: `You were added to team "${team.name}"`,
    message: `${caller.name} added you to "${team.name}". Shared ClawFS: /teams/${params.id}/shared/`,
    metadata: { team_id: params.id, team_name: team.name, added_by: caller.agent_id },
    read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    team_id: params.id,
    team_name: team.name,
    added_agent: agent_id,
    added_agent_name: newMember.name,
    member_count: newMeta.member_ids.length,
    clawfs_namespace: `/teams/${params.id}/shared/`,
    message: `${newMember.name} added to "${team.name}". They now have access to the shared ClawFS namespace.`,
  }))
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const caller = await resolveAgent(req)
  if (!caller) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { agent_id } = body
  if (!agent_id) return applySecurityHeaders(NextResponse.json({ error: 'agent_id required' }, { status: 400 }))

  const team = await getTeam(sb, params.id)
  if (!team) return applySecurityHeaders(NextResponse.json({ error: 'Team not found' }, { status: 404 }))

  const ownerId: string = team.metadata?.owner_id
  // Owner can remove anyone; members can remove themselves
  if (caller.agent_id !== ownerId && caller.agent_id !== agent_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'Only the team owner can remove other members' }, { status: 403 }))
  }
  if (agent_id === ownerId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Owner cannot be removed — transfer ownership first' }, { status: 400 }))
  }

  const newMemberIds = (team.metadata?.member_ids || []).filter((id: string) => id !== agent_id)
  const newMeta = { ...team.metadata, member_ids: newMemberIds }
  await sb.from('agent_registry').update({ metadata: newMeta }).eq('agent_id', params.id)

  return applySecurityHeaders(NextResponse.json({
    success: true,
    team_id: params.id,
    removed_agent: agent_id,
    member_count: newMemberIds.length,
  }))
}
