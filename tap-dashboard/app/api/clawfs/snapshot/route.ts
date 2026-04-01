/**
 * POST /api/clawfs/snapshot
 * Create a Merkle-root checkpoint of the agent's current ClawFS state.
 * Accepts API key auth (X-API-Key or Authorization: Bearer) — no Ed25519 signature required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
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

function generateMerkleRoot(cids: string[]): string {
  if (cids.length === 0) return 'bafy0000000000000000000000000000000000000000000000'
  const combined = cids.sort().join('')
  const hash = createHash('sha256').update(combined).digest('hex')
  return `bafy${hash.slice(0, 44)}`
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)

  if (!agent) {
    return applySecurityHeaders(NextResponse.json(
      { error: 'Unauthorized. Send X-API-Key or Authorization: Bearer header.', hint: 'Use your moltos_sk_... API key' },
      { status: 401 }
    ))
  }

  // Get all agent files
  const { data: files } = await (sb as any)
    .from('clawfs_files')
    .select('cid, path, created_at')
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: true })

  const fileList = (files || []) as { cid: string; path: string }[]
  const fileCIDs = fileList.map(f => f.cid)
  const merkleRoot = generateMerkleRoot(fileCIDs)
  const snapshotSig = `api_key_snapshot_${createHash('sha256').update(agent.agent_id + Date.now()).digest('hex').slice(0, 16)}`

  const { data: snapshot, error } = await (sb as any)
    .from('clawfs_snapshots')
    .insert({
      agent_id: agent.agent_id,
      public_key: agent.public_key || agent.agent_id,
      signature: snapshotSig,
      merkle_root: merkleRoot,
      file_count: fileCIDs.length,
      file_cids: fileCIDs,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !snapshot) {
    return applySecurityHeaders(NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 }))
  }

  return applySecurityHeaders(NextResponse.json({
    success: true,
    snapshot_id: snapshot.id,
    merkle_root: snapshot.merkle_root,
    file_count: snapshot.file_count,
    created_at: snapshot.created_at,
    files: fileList.map(f => ({ path: f.path, cid: f.cid })),
    message: 'Snapshot created. Your state is now Merkle-rooted. Mount this snapshot on any machine to restore.',
    restore_cmd: `curl -X POST https://moltos.org/api/clawfs/mount -H "X-API-Key: YOUR_KEY" -d '{"snapshot_id":"${snapshot.id}"}'`,
  }))
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { data: snapshots } = await (sb as any)
    .from('clawfs_snapshots')
    .select('id, merkle_root, file_count, created_at')
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(10)

  return applySecurityHeaders(NextResponse.json({
    snapshots: snapshots || [],
    count: snapshots?.length || 0,
  }))
}
