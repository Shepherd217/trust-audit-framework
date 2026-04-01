import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import type { Tables } from '@/lib/database.types'

type Agent = Tables<'agents'>
type ClawFSSnapshot = Tables<'clawfs_snapshots'>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, snapshot_id, public_key, signature, timestamp } = body

    // Support both authenticated methods
    let agentPublicKey = public_key
    
    if (!agentPublicKey && signature) {
      // Verify ClawID signature
      if (!timestamp) {
        return NextResponse.json({ error: 'Missing timestamp for signature verification' }, { status: 400 })
      }
      
      const payload = { action: 'mount', snapshot_id, timestamp }
      const verification = await verifyClawIDSignature(public_key, signature, payload)
      if (!verification.valid) {
        return NextResponse.json({ error: verification.error || 'Invalid ClawID signature' }, { status: 401 })
      }
    }

    // Look up agent by public key or agent_id
    let agent: Agent | null = null
    
    // Check agents table (legacy) then agent_registry
    const lookupBy = agentPublicKey ? { col: 'public_key', val: agentPublicKey } : agent_id ? { col: 'agent_id', val: agent_id } : null
    if (lookupBy) {
      const { data: a1 } = await supabase.from('agents').select('agent_id, public_key').eq(lookupBy.col, lookupBy.val).single()
      if (a1) { agent = a1 as Agent }
      if (!agent) {
        const { data: a2 } = await supabase.from('agent_registry').select('agent_id, public_key').eq(lookupBy.col, lookupBy.val).single()
        if (a2) agent = a2 as Agent
      }
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get the snapshot
    let snapshotQuery = supabase
      .from('clawfs_snapshots')
      .select('id, merkle_root, file_count, file_cids, created_at')
      .eq('agent_id', agent.agent_id)
    
    // If specific snapshot_id provided, use it; otherwise get latest
    if (snapshot_id && snapshot_id !== 'latest') {
      snapshotQuery = snapshotQuery.eq('id', snapshot_id)
    } else {
      snapshotQuery = snapshotQuery.order('created_at', { ascending: false })
    }
    
    const { data: snapshot, error: snapshotError } = await snapshotQuery.single()

    if (snapshotError || !snapshot) {
      return NextResponse.json({ 
        error: 'Snapshot not found',
        details: snapshot_id === 'latest' ? 'No snapshots exist for this agent' : `Snapshot ${snapshot_id} not found`
      }, { status: 404 })
    }

    // Get file details from the snapshot
    const fileCids = (snapshot.file_cids || []) as string[]
    
    const { data: files } = await supabase
      .from('clawfs_files')
      .select('path, cid')
      .eq('agent_id', agent.agent_id)
      .in('cid', fileCids)

    return NextResponse.json({
      success: true,
      message: 'Snapshot mounted successfully',
      snapshot: {
        id: snapshot.id,
        merkle_root: snapshot.merkle_root,
        file_count: snapshot.file_count,
        created_at: snapshot.created_at,
      },
      files: (files || []).map(f => ({ path: f.path, cid: f.cid })),
      agent: {
        agent_id: agent.agent_id,
        public_key: agent.public_key,
      },
      restored_at: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Mount error:', error)
    return NextResponse.json({ 
      error: 'Failed to mount snapshot',
      message: error.message 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const public_key = searchParams.get('public_key')
    const agent_id = searchParams.get('agent_id')

    if (!public_key && !agent_id) {
      return NextResponse.json({ error: 'Missing public_key or agent_id parameter' }, { status: 400 })
    }

    let agent: Agent | null = null
    
    const lookupCol = public_key ? 'public_key' : 'agent_id'
    const lookupVal = public_key || agent_id
    if (lookupVal) {
      const { data: a1 } = await supabase.from('agents').select('agent_id').eq(lookupCol, lookupVal).single()
      if (a1) agent = a1 as Agent
      if (!agent) {
        const { data: a2 } = await supabase.from('agent_registry').select('agent_id').eq(lookupCol, lookupVal).single()
        if (a2) agent = a2 as Agent
      }
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get the latest snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('clawfs_snapshots')
      .select('id, merkle_root, file_count, created_at')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json({ 
        error: 'No snapshots found',
        message: 'Create a snapshot first using moltos clawfs snapshot'
      }, { status: 404 })
    }

    return NextResponse.json({
      latest_snapshot: snapshot,
      can_restore: true,
      agent_id: agent.agent_id,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check mount status' }, { status: 500 })
  }
}
