import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
  return signature.length > 0 && publicKey.length > 0
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      // ClawID auth
      public_key,
      signature,
      timestamp,
    } = body

    if (!public_key || !signature) {
      return NextResponse.json(
        { error: 'Missing ClawID signature' },
        { status: 400 }
      )
    }

    // Verify ClawID signature
    const payload = { action: 'snapshot', timestamp }
    const isValid = await verifyClawIDSignature(public_key, signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .single() as { data: { agent_id: string } | null; error: any }

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get all files for this agent
    const { data: files } = await supabase
      .from('clawfs_files')
      .select('cid, path')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: true })
    as { data: Array<{ cid: string; path: string }> | null; error: any }

    // Generate Merkle tree root from file CIDs
    const fileCIDs = (files || []).map(f => f.cid)
    const merkleRoot = generateMerkleRoot(fileCIDs)

    // Create snapshot record
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
    as { 
      data: { 
        id: string
        merkle_root: string
        file_count: number
        created_at: string
      } | null
      error: any 
    }

    if (snapshotError) {
      console.error('Failed to create snapshot:', snapshotError)
      return NextResponse.json(
        { error: 'Failed to create snapshot' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot!.id,
        merkle_root: snapshot!.merkle_root,
        file_count: snapshot!.file_count,
        created_at: snapshot!.created_at,
      },
      // Return the files included in this snapshot
      files: files?.map(f => ({
        path: f.path,
        cid: f.cid,
      })) || [],
    })
  } catch (error) {
    console.error('ClawFS snapshot error:', error)
    return NextResponse.json(
      { error: 'Failed to create snapshot' },
      { status: 500 }
    )
  }
}

function generateMerkleRoot(cids: string[]): string {
  // Mock Merkle root generation
  // In production, build actual binary Merkle tree and hash pairs
  if (cids.length === 0) {
    return 'bafy0000000000000000000000000000000000000000'
  }
  
  const combined = cids.join('')
  const hash = Buffer.from(combined).toString('hex').slice(0, 44)
  return `bafy${hash}`
}

// GET to list snapshots for an agent
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const public_key = searchParams.get('public_key')

    if (!public_key) {
      return NextResponse.json(
        { error: 'Missing public_key parameter' },
        { status: 400 }
      )
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .single() as { data: { agent_id: string } | null; error: any }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const { data: snapshots } = await supabase
      .from('clawfs_snapshots')
      .select('id, merkle_root, file_count, created_at')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(10)
    as { data: Array<{ id: string; merkle_root: string; file_count: number; created_at: string }> | null; error: any }

    return NextResponse.json({
      snapshots: snapshots || [],
      count: snapshots?.length || 0,
    })
  } catch (error) {
    console.error('ClawFS list snapshots error:', error)
    return NextResponse.json(
      { error: 'Failed to list snapshots' },
      { status: 500 }
    )
  }
}
