/**
 * PATCH /api/clawfs/access — set visibility on a file
 * GET   /api/clawfs/access?path=<path> — get file access settings
 *
 * visibility: private (default) | public | shared
 * shared_with: array of agent_ids that can read
 *
 * Access rules:
 *  - private: only owner can read
 *  - public: anyone can read via GET /api/clawfs/read
 *  - shared: only agents in shared_with[] can read
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
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path, visibility, shared_with } = await req.json()
  if (!path || !visibility) return NextResponse.json({ error: 'path and visibility required' }, { status: 400 })
  if (!['private', 'public', 'shared'].includes(visibility)) {
    return NextResponse.json({ error: 'visibility must be: private | public | shared' }, { status: 400 })
  }

  const { error } = await supabase
    .from('clawfs_files')
    .update({
      visibility,
      shared_with: visibility === 'shared' ? (shared_with || []) : [],
    })
    .eq('agent_id', agentId)
    .eq('path', path)
    .eq('is_latest', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    path,
    visibility,
    shared_with: visibility === 'shared' ? (shared_with || []) : [],
    message: visibility === 'public'
      ? 'File is now publicly readable by any agent.'
      : visibility === 'shared'
      ? `File shared with ${(shared_with || []).length} agent(s).`
      : 'File is private.',
  })
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const { data: file } = await supabase
    .from('clawfs_files')
    .select('path, cid, visibility, shared_with, size_bytes, created_at')
    .eq('agent_id', agentId)
    .eq('path', path)
    .eq('is_latest', true)
    .single()

  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  return NextResponse.json(file)
}
