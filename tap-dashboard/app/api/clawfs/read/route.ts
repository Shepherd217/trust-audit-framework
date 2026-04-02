export const dynamic = 'force-dynamic';
/**
 * GET /api/clawfs/read?path=...  OR  ?cid=...
 * Read a file from ClawFS.
 *
 * Access control:
 *   - system_seeded files (onboarding docs): public to anyone with agent's agent_id
 *   - private files: only the owner's API key can read them
 *   - shared files: owner + explicitly shared agents
 *   - public files: anyone
 */
import { NextRequest, NextResponse } from 'next/server'
import { flagViolation } from '@/lib/security-violations'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase()
    .from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(request: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(request.url)
  const cid = searchParams.get('cid')
  const path = searchParams.get('path')
  const agentIdParam = searchParams.get('agent_id') // optional hint

  if (!cid && !path) {
    return NextResponse.json({ error: 'Missing cid or path parameter' }, { status: 400 })
  }

  // Build query
  let query = sb.from('clawfs_files').select('*')
  if (cid) query = query.eq('cid', cid)
  else query = query.eq('path', path)

  const { data: file, error } = await query.maybeSingle()

  if (error || !file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const visibility = file.visibility || 'private'
  const fileOwner = file.agent_id

  // System-seeded onboarding files — readable by anyone who knows the path
  if (file.signature === 'system_seeded') {
    return NextResponse.json({
      success: true,
      file: {
        id: file.id, path: file.path, cid: file.cid,
        content_type: file.content_type, size_bytes: file.size_bytes,
        created_at: file.created_at, agent_id: file.agent_id,
      },
      content: file.content_preview || null,
      content_url: `/api/clawfs/content/${file.cid}`,
    })
  }

  // Public files — anyone can read
  if (visibility === 'public') {
    return NextResponse.json({
      success: true,
      file: {
        id: file.id, path: file.path, cid: file.cid,
        content_type: file.content_type, size_bytes: file.size_bytes,
        created_at: file.created_at, agent_id: file.agent_id,
      },
      content: file.content_preview || null,
      content_url: `/api/clawfs/content/${file.cid}`,
    })
  }

  // Private/shared — must be authenticated AND be the owner
  const requestingAgentId = await resolveAgentId(request)

  if (!requestingAgentId) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 }) // don't reveal existence
  }

  if (requestingAgentId !== fileOwner) {
    // Check shared_with array
    const sharedWith: string[] = file.shared_with || []
    if (!sharedWith.includes(requestingAgentId)) {
      // Flag cross-agent read attempt (private file)
      await flagViolation(requestingAgentId, 'cross_agent_read', { target_agent: fileOwner, path: file.path }, '/clawfs/read')
      return NextResponse.json({ error: 'File not found' }, { status: 404 }) // don't reveal existence
    }
  }

  // Owner or explicitly shared — return file
  return NextResponse.json({
    success: true,
    file: {
      id: file.id, path: file.path, cid: file.cid,
      content_type: file.content_type, size_bytes: file.size_bytes,
      created_at: file.created_at, agent_id: file.agent_id,
    },
    content: file.content_preview || null,
    content_url: `/api/clawfs/content/${file.cid}`,
  })
}
