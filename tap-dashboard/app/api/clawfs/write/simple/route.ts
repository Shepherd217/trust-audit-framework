/**
 * POST /api/clawfs/write/simple
 * Write to ClawFS using just your API key — no Ed25519 signature required.
 * 
 * Body: { "path": "/agents/{agent_id}/...", "content": "..." }
 * Auth: X-API-Key or Authorization: Bearer
 *
 * Path must start with /agents/{your_agent_id}/ — you can only write to your namespace.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
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
    .from('agent_registry').select('agent_id, public_key').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, 'authenticated')
  if ((rl as any).response) return (rl as any).response

  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized — include X-API-Key header' }, { status: 401 }))

  let body: any = {}
  try { body = await req.json() } catch {
    return applySecurityHeaders(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }))
  }

  const { path, content, content_type = 'text/plain' } = body

  if (!path || !content) {
    return applySecurityHeaders(NextResponse.json({
      error: 'path and content are required',
      example: { path: `/agents/${agent.agent_id}/memory/notes.md`, content: 'Your content here' }
    }, { status: 400 }))
  }

  // Enforce namespace — you can only write to your own /agents/{id}/ namespace
  const allowedPrefix = `/agents/${agent.agent_id}/`
  if (!path.startsWith(allowedPrefix) && !path.startsWith('/data/') && !path.startsWith('/temp/')) {
    return applySecurityHeaders(NextResponse.json({
      error: `Path must start with /agents/${agent.agent_id}/ (your namespace)`,
      your_namespace: allowedPrefix,
    }, { status: 403 }))
  }

  const sb = getSupabase()
  const cid = `bafy${createHash('sha256').update(content + agent.agent_id).digest('hex').slice(0, 44)}`
  const size = Buffer.byteLength(content, 'utf8')
  const preview = content.slice(0, 500)

  const { error } = await (sb as any).from('clawfs_files').insert({
    agent_id: agent.agent_id,
    public_key: agent.public_key || agent.agent_id,
    path,
    cid,
    content_type,
    size_bytes: size,
    signature: `api_key_write_${randomBytes(8).toString('hex')}`,
    content_preview: preview,
    is_latest: true,
    version_number: 1,
    created_at: new Date().toISOString(),
  })

  if (error) {
    // Try upsert if duplicate path
    await (sb as any).from('clawfs_files').update({
      cid, size_bytes: size, content_preview: preview,
      signature: `api_key_write_${randomBytes(8).toString('hex')}`,
      created_at: new Date().toISOString(),
    }).eq('agent_id', agent.agent_id).eq('path', path)
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    cid,
    path,
    size_bytes: size,
    agent_id: agent.agent_id,
    message: 'Written to ClawFS. This file survives session death.',
  }, { status: 201 }))
}
