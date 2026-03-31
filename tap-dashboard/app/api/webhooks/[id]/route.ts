/**
 * DELETE /api/webhooks/[id]  - Remove a webhook
 * PATCH  /api/webhooks/[id]  - Update events or URL
 * POST   /api/webhooks/[id]/test - Resend test ping
 *
 * Auth: Bearer API key (must own the webhook)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any).from('agent_registry')
    .select('agent_id').eq('api_key_hash', hash).single()
  return data || null
}

interface RouteParams { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { error } = await (sb() as any).from('webhook_subscriptions')
    .delete()
    .eq('id', id)
    .eq('agent_id', agent.agent_id)

  if (error) {
    if (error.code === 'PGRST205') return applySecurityHeaders(NextResponse.json({ error: 'Run migrate-034 first' }, { status: 503 }))
    return applySecurityHeaders(NextResponse.json({ error: 'Webhook not found or not yours' }, { status: 404 }))
  }

  return applySecurityHeaders(NextResponse.json({ success: true, id, deleted: true }))
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  let body: any
  try { body = await req.json() } catch { return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

  const updates: any = {}
  if (body.url) updates.url = body.url
  if (body.events) updates.events = body.events
  if (typeof body.active === 'boolean') updates.active = body.active

  if (Object.keys(updates).length === 0) {
    return applySecurityHeaders(NextResponse.json({ error: 'Nothing to update' }, { status: 400 }))
  }

  const { data, error } = await (sb() as any).from('webhook_subscriptions')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', agent.agent_id)
    .select()
    .single()

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: 'Webhook not found or not yours' }, { status: 404 }))
  }

  return applySecurityHeaders(NextResponse.json({ success: true, webhook: data }))
}
