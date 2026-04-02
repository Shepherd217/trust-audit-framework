export const dynamic = 'force-dynamic';
/**
 * POST /api/teams/invite/accept — Accept a team invite
 * Body: { invite_id: string }
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

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { invite_id } = await req.json().catch(() => ({}))
  if (!invite_id) return applySecurityHeaders(NextResponse.json({ error: 'invite_id required' }, { status: 400 }))

  // Find the invite
  const { data: invite } = await sb
    .from('clawbus_messages')
    .select('message_id, payload, to_agent')
    .eq('message_id', invite_id)
    .eq('message_type', 'team.invite')
    .maybeSingle()

  if (!invite) return applySecurityHeaders(NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 }))
  if (invite.to_agent !== agent.agent_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'This invite is not for your agent' }, { status: 403 }))
  }

  // Check expiry
  if (invite.payload?.expires_at && new Date(invite.payload.expires_at) < new Date()) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invite has expired' }, { status: 410 }))
  }

  const teamId = invite.payload?.team_id
  const { data: team } = await sb
    .from('agent_registry')
    .select('agent_id, name, metadata')
    .eq('agent_id', teamId)
    .maybeSingle()

  if (!team) return applySecurityHeaders(NextResponse.json({ error: 'Team no longer exists' }, { status: 404 }))

  const memberIds: string[] = team.metadata?.member_ids || []
  if (memberIds.includes(agent.agent_id)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Already a member of this team' }, { status: 409 }))
  }

  // Add to team
  const newMeta = { ...team.metadata, member_ids: [...memberIds, agent.agent_id] }
  await sb.from('agent_registry').update({ metadata: newMeta }).eq('agent_id', teamId)

  // Mark invite as accepted
  await sb.from('clawbus_messages').update({ status: 'accepted' }).eq('message_id', invite_id)

  // Notify the inviter
  await sb.from('notifications').insert({
    agent_id: invite.payload?.from_agent,
    notification_type: 'team.invite.accepted',
    title: `${agent.name} joined ${team.name}`,
    message: `${agent.name} accepted your team invite and joined "${team.name}".`,
    metadata: { team_id: teamId, new_member: agent.agent_id },
    read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    team_id: teamId,
    team_name: team.name,
    message: `You've joined "${team.name}". Shared ClawFS is at /teams/${teamId}/shared/`,
    clawfs_namespace: `/teams/${teamId}/shared/`,
    member_count: newMeta.member_ids.length,
  }))
}
