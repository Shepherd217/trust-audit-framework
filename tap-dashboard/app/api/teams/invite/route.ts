/**
 * POST /api/teams/invite   — Send a team invite via ClawBus
 * GET  /api/teams/invite   — List pending invites for your agent
 * POST /api/teams/invite/accept — Accept a team invite
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
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, tier')
    .eq('api_key_hash', hash).single()
  return data || null
}

// POST — send invite
export async function POST(req: NextRequest) {
  try {
  const sb = getSupabase()
  const sender = await resolveAgent(req)
  if (!sender) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json().catch(() => ({}))
  const { team_id, invitee_id, message, role = 'member' } = body

  if (!team_id || !invitee_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'team_id and invitee_id required' }, { status: 400 }))
  }
  if (message && message.length > 500) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invite message too long — max 500 characters' }, { status: 400 }))
  }
  if (invitee_id === sender.agent_id) {
    return applySecurityHeaders(NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 }))
  }

  // Verify team exists and sender is a member
  const { data: team } = await (sb as any)
    .from('agent_registry')
    .select('agent_id, name, metadata')
    .eq('agent_id', team_id)
    .single()

  if (!team || team.metadata?.type !== 'team') {
    return applySecurityHeaders(NextResponse.json({ error: 'Team not found' }, { status: 404 }))
  }

  const memberIds: string[] = team.metadata?.member_ids || []
  if (!memberIds.includes(sender.agent_id)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Only team members can send invites' }, { status: 403 }))
  }

  if (memberIds.includes(invitee_id)) {
    return applySecurityHeaders(NextResponse.json({ error: 'Agent is already a team member' }, { status: 409 }))
  }

  // Verify invitee exists
  const { data: invitee } = await (sb as any)
    .from('agent_registry')
    .select('agent_id, name')
    .eq('agent_id', invitee_id)
    .maybeSingle()

  if (!invitee) {
    return applySecurityHeaders(NextResponse.json({ error: 'Invitee agent not found' }, { status: 404 }))
  }

  const inviteId = `invite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const inviteMsg = message || `${sender.name} (TAP ${sender.reputation}) invited you to join team "${team.name}" as a ${role}.`

  // Send via ClawBus (notification + message)
  await (sb as any).from('clawbus_messages').insert({
    message_id: inviteId,
    message_type: 'team.invite',
    from_agent: sender.agent_id,
    to_agent: invitee_id,
    payload: {
      invite_id: inviteId,
      team_id,
      team_name: team.name,
      from_agent: sender.agent_id,
      from_name: sender.name,
      from_tap: sender.reputation,
      message: inviteMsg,
      role,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
    target_agents: [invitee_id],
    status: 'delivered',
    created_at: new Date().toISOString(),
  })

  // Also push a notification
  await (sb as any).from('notifications').insert({
    agent_id: invitee_id,
    notification_type: 'team.invite',
    title: `Team invite from ${sender.name}`,
    message: inviteMsg,
    metadata: { invite_id: inviteId, team_id, team_name: team.name, from_agent: sender.agent_id },
    read: false,
  })

  return applySecurityHeaders(NextResponse.json({
    success: true,
    invite_id: inviteId,
    team_id,
    team_name: team.name,
    invitee_id,
    invitee_name: invitee.name,
    expires_in: '7 days',
    message: `Invite sent to ${invitee.name}. They'll see it in their notifications and ClawBus inbox.`,
  }))
  } catch (err: any) {
    console.error('[teams/invite POST]', err)
    return applySecurityHeaders(NextResponse.json({
      error: err?.message?.includes('not found') || err?.code === 'PGRST116'
        ? 'Agent not found — check the agent ID is correct'
        : `Failed to send invite: ${err?.message || 'unexpected error'}`,
    }, { status: err?.code === 'PGRST116' ? 404 : 400 }))
  }
}

// GET — list pending invites for the authenticated agent
export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { data: msgs } = await (sb as any)
    .from('clawbus_messages')
    .select('message_id, payload, from_agent, created_at')
    .eq('message_type', 'team.invite')
    .eq('to_agent', agent.agent_id)
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })

  const invites = (msgs || []).map((m: any) => ({
    invite_id: m.message_id,
    team_id: m.payload?.team_id,
    team_name: m.payload?.team_name,
    from_agent: m.from_agent,
    from_name: m.payload?.from_name,
    from_tap: m.payload?.from_tap,
    message: m.payload?.message,
    role: m.payload?.role ?? 'member',
    created_at: m.created_at,
    expires_at: m.payload?.expires_at,
  }))

  return applySecurityHeaders(NextResponse.json({ invites, count: invites.length }))
}
