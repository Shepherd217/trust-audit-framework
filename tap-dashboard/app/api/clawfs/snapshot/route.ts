import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import type { Tables } from '@/lib/database.types'

type Agent = Tables<'agents'>
type ClawFSFile = Tables<'clawfs_files'>
type ClawFSSnapshot = Tables<'clawfs_snapshots'>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { public_key, signature, timestamp } = body

    if (!public_key || !signature) {
      return NextResponse.json({ error: 'Missing ClawID signature' }, { status: 400 })
    }

    // Support both legacy payload format and new signed format
    const challenge = body.challenge
    const payload = challenge
      ? { path: '/snapshot', content_hash: body.content_hash || '', challenge, timestamp }
      : { action: 'snapshot', timestamp }

    const verification = await verifyClawIDSignature(public_key, signature, payload)
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error || 'Invalid ClawID signature' }, { status: 401 })
    }

    // Check both tables
    let agent: { agent_id: string } | null = null
    const { data: legacyAgent } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .single()
    if (legacyAgent) {
      agent = legacyAgent
    } else {
      const { data: regAgent } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id')
        .eq('public_key', public_key)
        .single()
      if (regAgent) agent = regAgent
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const { data: files } = await supabase
      .from('clawfs_files')
      .select('cid, path')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: true })

    const fileList = (files || []) as { cid: string; path: string }[]
    const fileCIDs = fileList.map(f => f.cid)
    const merkleRoot = generateMerkleRoot(fileCIDs)

    const { data: snapshot, error: snapshotError } = await supabase
      .from('clawfs_snapshots')
      .insert({
        agent_id: agent.agent_id,
        public_key,
        signature,
        merkle_root: merkleRoot,
        file_count: fileCIDs.length,
        file_cids: fileCIDs,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        merkle_root: snapshot.merkle_root,
        file_count: snapshot.file_count,
        created_at: snapshot.created_at,
      },
      files: fileList.map(f => ({ path: f.path, cid: f.cid })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 })
  }
}

function generateMerkleRoot(cids: string[]): string {
  if (cids.length === 0) return 'bafy0000000000000000000000000000000000000000'
  const combined = cids.join('')
  const hash = Buffer.from(combined).toString('hex').slice(0, 44)
  return `bafy${hash}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const public_key = searchParams.get('public_key')

    if (!public_key) {
      return NextResponse.json({ error: 'Missing public_key parameter' }, { status: 400 })
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const { data: snapshots } = await supabase
      .from('clawfs_snapshots')
      .select('id, merkle_root, file_count, created_at')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      snapshots: snapshots || [],
      count: snapshots?.length || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list snapshots' }, { status: 500 })
  }
}
