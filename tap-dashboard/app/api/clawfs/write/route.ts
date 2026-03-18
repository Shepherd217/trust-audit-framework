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
      path,
      content, // base64 encoded
      content_type = 'application/octet-stream',
      // ClawID auth
      public_key,
      signature,
      timestamp,
    } = body

    if (!path || !content || !public_key || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify ClawID signature
    const payload = { path, content_hash: hashContent(content), timestamp }
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
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Generate CID (Content Identifier) - mock Blake3 hash
    const cid = generateCID(content, public_key)

    // Store file metadata in Supabase
    const { data: file, error: fileError } = await supabase
      .from('clawfs_files')
      .insert({
        agent_id: agent.agent_id,
        public_key,
        path,
        cid,
        content_type,
        size_bytes: Buffer.from(content, 'base64').length,
        signature,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (fileError) {
      console.error('Failed to store file:', fileError)
      return NextResponse.json(
        { error: 'Failed to write to ClawFS' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        path: file.path,
        cid: file.cid,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
      },
      merkle_root: generateMerkleRoot(cid, public_key),
    })
  } catch (error) {
    console.error('ClawFS write error:', error)
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    )
  }
}

function hashContent(content: string): string {
  // Mock Blake3 hash - in production use actual Blake3
  return Buffer.from(content).toString('hex').slice(0, 64)
}

function generateCID(content: string, publicKey: string): string {
  // Mock CID generation - in production use actual content addressing
  const hash = hashContent(content + publicKey)
  return `bafy${hash.slice(0, 44)}`
}

function generateMerkleRoot(cid: string, publicKey: string): string {
  // Mock Merkle root - in production compute actual Merkle tree
  return `bafy${Buffer.from(cid + publicKey).toString('hex').slice(0, 44)}`
}
