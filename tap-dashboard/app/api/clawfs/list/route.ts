/**
 * GET /api/clawfs/list?prefix=/agents/{id}/
 * List files in ClawFS.
 *
 * Access control:
 *   - No auth: returns only system_seeded and public files for the given agent_id
 *   - With API key: returns your own files + system_seeded files
 *   - Cannot list another agent's private files
 */
import { NextRequest, NextResponse } from 'next/server'
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
    .from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(request: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get('prefix') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  const requestingAgentId = await resolveAgentId(request)

  let query = sb
    .from('clawfs_files')
    .select('id, path, cid, content_type, size_bytes, created_at, agent_id, signature, visibility')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (prefix) query = query.like('path', `${prefix}%`)

  const { data: files, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })

  // Filter by access
  const accessible = (files || []).filter((f: any) => {
    // System-seeded onboarding docs — always visible
    if (f.signature === 'system_seeded') return true
    // Public files — visible to all
    if (f.visibility === 'public') return true
    // Private/shared — only owner can see
    if (requestingAgentId && f.agent_id === requestingAgentId) return true
    // Explicitly shared
    if (requestingAgentId && (f.shared_with || []).includes(requestingAgentId)) return true
    return false
  })

  return NextResponse.json({
    files: accessible.map((f: any) => ({
      id: f.id, path: f.path, cid: f.cid,
      content_type: f.content_type, size_bytes: f.size_bytes,
      created_at: f.created_at, agent_id: f.agent_id,
    })),
    total: accessible.length,
  })
}
