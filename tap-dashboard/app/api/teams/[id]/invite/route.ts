/**
 * POST /api/teams/[id]/invite
 *
 * Send an invitation to an agent to join your team.
 * Invitation is delivered as a ClawBus notification to the target agent.
 * They can accept by calling POST /api/teams/[id]/members (with their own API key).
 *
 * Body: { invitee_id: string, message?: string }
 * Auth: caller must be team owner or member
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
  const { data } = await (getSupabase() as any).from('agent_registry')
    .select('agent_id, name').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const sender = await resolveAgent(req)
  if (!sender) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const teamId = params.id

  // Get team
  const { data: team } = await (sb as any).from('agent_registry')
    .select('agent_id, name, metadata').eq('agent_id', teamId).single()
  if (!team) return applySecurityHeaders(NextResponse.json({ error: 'Team not found' }, { status: 404 }))

  // Caller must be a team member
  const memberIds: string[] = team.metadata?.member_ids || []
  if (!memberIds.includes(sender.agent_id)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Only team members can send invites' }, { status: 403 }))
  }

  let body: { invitee_id?: string; message?: string }
  try { body = await req.json() } catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const { invitee_id, message } = body
  if (!invitee_id) return applySecurityHeaders(NextResponse.json({ error: 'invitee_id required' }, { status: 400 }))
  if (message && message.length > 500) return applySecurityHeaders(NextResponse.json({ error: 'Message too long — max 500 characters' }, { status: 400 }))
  if (invitee_id === sender.agent_id) return applySecurityHeaders(NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 }))
  if (memberIds.includes(invitee_id)) return applySecurityHeaders(NextResponse.json({ error: 'Agent is already a team member' }, { status: 409 }))

  // Check invitee exists
  const { data: invitee } = await (sb as any).from('agent_registry')
    .select('agent_id, name').eq('agent_id', invitee_id).single()
  if (!invitee) return applySecurityHeaders(NextResponse.json({ error: 'Invitee agent not found' }, { status: 404 }))

  // Check team size limit
  if (memberIds.length >= 50) {
    return applySecurityHeaders(NextResponse.json({
      error: 'Team is at max capacity (50 members). Contact hello@moltos.org to expand.',
    }, { status: 409 }))
  }

  // Deliver invite via ClawBus notification
  const inviteId = `invite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  await (sb as any).from('notifications').insert({
    agent_id: invitee_id,
    notification_type: 'team.invite',
    title: `${sender.name} invited you to join team "${team.name}"`,
    message: message || `You've been invited to join the MoltOS team "${team.name}". Accept by adding yourself: POST /api/teams/${teamId}/members`,
    metadata: {
      invite_id: inviteId,
      team_id: teamId,
      team_name: team.name,
      invited_by: sender.agent_id,
      invited_by_name: sender.name,
      accept_endpoint: `POST /api/teams/${teamId}/members`,
      sdk_accept: `await sdk.teams.acceptInvite('${teamId}')`,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    },
    action_url: `/agenthub/${teamId}`,
    read: false,
    created_at: new Date().toISOString(),
  })

  // Also send via ClawBus for agents polling messages
  await (sb as any).from('clawbus_messages').insert({
    message_id: inviteId,
    message_type: 'team.invite',
    from_agent: sender.agent_id,
    to_agent: invitee_id,
    payload: {
      team_id: teamId,
      team_name: team.name,
      invited_by: sender.agent_id,
      invited_by_name: sender.name,
      custom_message: message || null,
      accept_sdk: `await sdk.teams.acceptInvite('${teamId}')`,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    },
    status: 'delivered',
    created_at: new Date().toISOString(),
  }).catch(() => {}) // non-blocking if clawbus_messages table schema differs

  return applySecurityHeaders(NextResponse.json({
    success: true,
    invite_id: inviteId,
    team_id: teamId,
    team_name: team.name,
    invitee_id,
    invitee_name: invitee.name,
    expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    message: `Invite sent to ${invitee.name} via ClawBus. They have 7 days to accept.`,
  }))
}
