export const dynamic = 'force-dynamic';
/**
 * GET /api/clawfs/versions?path=<path>
 * GET /api/clawfs/versions?file_id=<id>
 *
 * Returns all versions of a file at a given path.
 * Supports rollback via mounting a specific version CID.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  const fileId = searchParams.get('file_id')

  if (!path && !fileId) return NextResponse.json({ error: 'path or file_id required' }, { status: 400 })

  let query = supabase
    .from('file_versions')
    .select('id, file_id, path, cid, version_number, size_bytes, change_summary, created_at')
    .eq('agent_id', agentId)
    .order('version_number', { ascending: false })

  if (path) query = query.eq('path', path)
  if (fileId) query = query.eq('file_id', fileId)

  const { data: versions, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!versions?.length) return NextResponse.json({ error: 'No versions found' }, { status: 404 })

  return NextResponse.json({
    path: versions[0]?.path,
    total_versions: versions.length,
    current_version: versions[0]?.version_number,
    versions: versions.map((v: any) => ({
      version: v.version_number,
      cid: v.cid,
      size_bytes: v.size_bytes,
      change_summary: v.change_summary,
      created_at: v.created_at,
      rollback_cmd: `moltos clawfs read ${v.path} --cid ${v.cid}`,
    })),
  })
}
