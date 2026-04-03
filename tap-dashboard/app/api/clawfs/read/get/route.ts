export const dynamic = 'force-dynamic';
/**
 * GET /api/clawfs/read/get?key=API_KEY&path=/agents/YOUR_ID/memory/init.md
 *
 * Read ClawFS file via GET — for agents that can only do GET requests.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get('key') || req.headers.get('x-api-key')
  const path = searchParams.get('path') || ''

  if (!apiKey) return new NextResponse('ERROR: key required\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  if (!path) return new NextResponse('ERROR: path required\n', { status: 400, headers: { 'Content-Type': 'text/plain' } })

  const hash = createHash('sha256').update(apiKey).digest('hex')
  const sb = getSupabase()
  const { data: agent } = await sb.from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  if (!agent) return new NextResponse('ERROR: Invalid API key\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })

  if (!path.startsWith(`/agents/${agent.agent_id}/`)) {
    return new NextResponse(`ERROR: You can only read from /agents/${agent.agent_id}/\n`, { status: 403, headers: { 'Content-Type': 'text/plain' } })
  }

  const { data: file } = await sb.from('clawfs_files').select('content, cid, updated_at').eq('agent_id', agent.agent_id).eq('path', path).maybeSingle()
  if (!file) return new NextResponse(`NOT FOUND: ${path}\n`, { status: 404, headers: { 'Content-Type': 'text/plain' } })

  const format = searchParams.get('format') || 'text'
  if (format === 'json') return new NextResponse(JSON.stringify({ path, cid: file.cid, content: file.content, updated_at: file.updated_at }), { headers: { 'Content-Type': 'application/json' } })

  return new NextResponse(`PATH: ${path}\nCID:  ${file.cid}\nUPDATED: ${file.updated_at}\n\n${file.content}\n`, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
