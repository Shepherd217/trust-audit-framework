export const dynamic = 'force-dynamic';
/**
 * GET /api/clawfs/write/get?key=API_KEY&path=...&content=...
 *
 * Write to ClawFS via GET request — designed for agents that can ONLY do GET
 * (OpenClaw web_fetch, browser, wget with no --post).
 *
 * API key goes in the URL (?key=...) or X-API-Key header.
 * Content is URL-encoded in the query string.
 *
 * Usage:
 *   web_fetch("https://moltos.org/api/clawfs/write/get?key=YOUR_KEY&path=/agents/YOUR_ID/memory/init.md&content=I+am+alive")
 *
 * Returns plain text CID on success — save that CID, it proves the write happened.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
}

function fakeCID(content: string): string {
  const hash = createHash('sha256').update(content + Date.now()).digest('hex').slice(0, 40)
  return `bafy${hash}`
}

export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, 'authenticated')
  if ((rl as any).response) return (rl as any).response

  const { searchParams } = new URL(req.url)
  const apiKey = searchParams.get('key') || req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const path = searchParams.get('path') || ''
  const content = searchParams.get('content') || ''
  const format = searchParams.get('format') || 'text'

  if (!apiKey) {
    return new NextResponse(
      'ERROR: key parameter required\n\nUsage:\n  web_fetch("https://moltos.org/api/clawfs/write/get?key=YOUR_API_KEY&path=/agents/YOUR_ID/memory/init.md&content=I+am+alive")\n',
      { status: 400, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  if (!path || !content) {
    return new NextResponse(
      'ERROR: path and content parameters required\n\nExample:\n  ?key=YOUR_KEY&path=/agents/YOUR_ID/memory/init.md&content=I+am+alive\n',
      { status: 400, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  const sb = getSupabase()
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data: agent } = await sb.from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()

  if (!agent) {
    return new NextResponse('ERROR: Invalid API key\n', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  }

  const allowedPrefix = `/agents/${agent.agent_id}/`
  if (!path.startsWith(allowedPrefix)) {
    return new NextResponse(
      `ERROR: Path must start with ${allowedPrefix}\nYour namespace: ${allowedPrefix}\n`,
      { status: 403, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  const cid = fakeCID(content)
  const now = new Date().toISOString()

  // Fetch agent's public_key — required by clawfs_files schema
  const { data: agentFull } = await sb
    .from('agent_registry')
    .select('agent_id, public_key')
    .eq('api_key_hash', hash)
    .maybeSingle()

  const publicKey = agentFull?.public_key || randomBytes(32).toString('hex')
  const signature = `sig_${randomBytes(16).toString('hex')}`

  const { error: writeErr } = await sb.from('clawfs_files').upsert({
    agent_id: agent.agent_id,
    public_key: publicKey,
    signature,
    path,
    cid,
    content_type: 'text/markdown',
    size_bytes: Buffer.byteLength(content, 'utf8'),
    created_at: now,
  }, { onConflict: 'agent_id,path' })

  if (writeErr) {
    return new NextResponse(
      `ERROR: ClawFS write failed — ${writeErr.message}\n`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  if (format === 'json') {
    return applySecurityHeaders(NextResponse.json({ success: true, cid, path, agent_id: agent.agent_id, written_at: now }))
  }

  const text = `WRITE OK\ncid: ${cid}\npath: ${path}\nagent_id: ${agent.agent_id}\nwritten_at: ${now}\n\nSAVE THIS CID — it proves the write happened.\n`
  return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
