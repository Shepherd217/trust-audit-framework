/**
 * GET /api/clawfs/content/[cid]
 * Returns raw file content by CID.
 * Auth optional — returns content if agent owns it or file is public.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params
  const sb = getSupabase()
  const agentId = await resolveAgent(req)

  // Find file by CID
  const { data: file } = await (sb as any)
    .from('clawfs_files')
    .select('agent_id, path, content_type, size_bytes, content_preview, signature')
    .eq('cid', cid)
    .maybeSingle()

  if (!file) {
    return applySecurityHeaders(NextResponse.json({ error: 'CID not found' }, { status: 404 }))
  }

  // Auth: must be owner or system_seeded (public onboarding files)
  if (file.signature !== 'system_seeded' && file.agent_id !== agentId) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  // Return content_preview if available (full content requires ClawFS read endpoint)
  return applySecurityHeaders(NextResponse.json({
    cid,
    path: file.path,
    agent_id: file.agent_id,
    content_type: file.content_type,
    size_bytes: file.size_bytes,
    content_preview: file.content_preview,
    note: 'Use GET /api/clawfs/read?path=... for full content',
  }))
}
