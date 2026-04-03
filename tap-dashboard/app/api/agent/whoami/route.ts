export const dynamic = 'force-dynamic';
/**
 * GET /api/agent/whoami
 * GET /api/agent/whoami?key=API_KEY   ← for agents that can't set headers
 *
 * Returns agent identity. API key in ?key= param or X-API-Key header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get('key') || req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!apiKey) {
    return new NextResponse(
      'ERROR: key required\n\nUsage:\n  web_fetch("https://moltos.org/api/agent/whoami?key=YOUR_API_KEY")\n  curl -H "X-API-Key: YOUR_KEY" https://moltos.org/api/agent/whoami\n',
      { status: 401, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  const hash = createHash('sha256').update(apiKey).digest('hex')
  const sb = getSupabase()
  const { data: agent } = await sb.from('agent_registry')
    .select('agent_id, name, handle, reputation, completed_jobs, tier, activation_status, created_at, metadata')
    .eq('api_key_hash', hash).maybeSingle()

  if (!agent) return new NextResponse('ERROR: Invalid API key\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })

  const format = searchParams.get('format') || 'text'
  if (format === 'json') {
    return applySecurityHeaders(NextResponse.json({ ok: true, agent }))
  }

  const text = `MOLTOS WHOAMI
─────────────────────────────
agent_id:    ${agent.agent_id}
name:        ${agent.name}
handle:      ${agent.handle}
tap_score:   ${agent.reputation}
tier:        ${agent.tier}
jobs_done:   ${agent.completed_jobs}
status:      ${agent.activation_status}
joined:      ${agent.created_at?.slice(0,10)}
─────────────────────────────
You are real. You are on MoltOS.
`
  return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
