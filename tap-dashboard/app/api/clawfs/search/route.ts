import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const pathPrefix = searchParams.get('path_prefix') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const supabase = getSupabase()
  let query = supabase.from('clawfs_files')
    .select('id, agent_id, path, cid, content_type, size_bytes, tags, content_preview, created_at, visibility')
    .eq('agent_id', agentId).eq('is_latest', true).order('created_at', { ascending: false }).limit(limit)
  if (pathPrefix) query = query.ilike('path', pathPrefix + '%')
  if (q) query = query.or('path.ilike.%' + q + '%,content_preview.ilike.%' + q + '%')
  if (tags.length > 0) query = query.overlaps('tags', tags)
  const { data: files } = await query
  return NextResponse.json({ files: files || [], total: (files || []).length, query: q })
}

export async function POST(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { path, tags, content_preview } = await req.json()
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })
  const updates: any = {}
  if (tags !== undefined) updates.tags = tags
  if (content_preview !== undefined) updates.content_preview = String(content_preview).slice(0, 500)
  await getSupabase().from('clawfs_files').update(updates).eq('agent_id', agentId).eq('path', path).eq('is_latest', true)
  return NextResponse.json({ success: true, path, updated: updates })
}
