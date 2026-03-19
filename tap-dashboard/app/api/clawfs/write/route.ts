import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import type { Tables } from '@/lib/database.types'

type Agent = Tables<'agents'>
type ClawFSFile = Tables<'clawfs_files'>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      path,
      content,
      content_type = 'application/octet-stream',
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
    const verification = await verifyClawIDSignature(public_key, signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up agent
    const agentResult = await supabase
      .from('user_agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .single()
    
    const agent = agentResult.data as { agent_id: string } | null
    const agentError = agentResult.error

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Generate CID
    const cid = generateCID(content, public_key)

    // Store file metadata in Supabase
    const fileResult = await supabase
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
    
    const file: ClawFSFile | null = fileResult.data
    const fileError = fileResult.error

    if (fileError || !file) {
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
        created_at: file.created_at ?? new Date().toISOString(),
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
  return Buffer.from(content).toString('hex').slice(0, 64)
}

function generateCID(content: string, publicKey: string): string {
  const hash = hashContent(content + publicKey)
  return `bafy${hash.slice(0, 44)}`
}

function generateMerkleRoot(cid: string, publicKey: string): string {
  return `bafy${Buffer.from(cid + publicKey).toString('hex').slice(0, 44)}`
}
