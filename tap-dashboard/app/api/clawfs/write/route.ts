export const dynamic = 'force-dynamic';
// Force redeploy timestamp: 2026-03-21T02:15:00Z
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'
import type { Tables } from '@/lib/database.types'

type Agent = Tables<'agents'>
type ClawFSFile = Tables<'clawfs_files'>

// Rate limit: 20 writes per minute per IP
const MAX_BODY_SIZE_KB = 1000; // 1MB max for file content
const MAX_PATH_LENGTH = 512;
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB decoded

export async function GET(request: NextRequest) {
  return NextResponse.json({
    version: 'ba1ba5f',
    timestamp: '2026-03-21T02:45:00Z',
    note: 'ClawFS write endpoint - version check'
  });
}

export async function POST(request: NextRequest) {
  const path = '/api/clawfs/write';
  
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    const {
      path: filePath,
      content,
      content_type = 'application/octet-stream',
      public_key,
      signature,
      timestamp,
      challenge,
    } = body

    // If no Ed25519 fields, redirect to /write/simple (API key only)
    if (!public_key || !signature || !challenge) {
      const xApiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (xApiKey && filePath && content) {
        const simpleUrl = new URL('/api/clawfs/write/simple', request.url)
        return fetch(simpleUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': xApiKey,
          },
          body: JSON.stringify({ path: filePath, content, content_type: body.content_type || 'text/plain' }),
        }).then(r => r.json()).then(data => {
          const res = NextResponse.json(data, { status: data.success ? 201 : 400 })
          return applySecurityHeaders(res)
        })
      }
      const response = NextResponse.json(
        { 
          error: 'Missing required fields',
          hint: 'For API key auth (no Ed25519), use POST /api/clawfs/write/simple with just {"path":"...","content":"..."}',
          simple_write: 'POST /api/clawfs/write/simple — X-API-Key header only, no signature needed',
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate path format (prevent path traversal)
    if (filePath.length > MAX_PATH_LENGTH) {
      const response = NextResponse.json(
        { error: 'Path too long' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    if (filePath.includes('..') || filePath.includes('\x00')) {
      const response = NextResponse.json(
        { error: 'Invalid path format' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    // Validate path starts with allowed prefixes
    const allowedPrefixes = ['/data/', '/apps/', '/agents/', '/temp/'];
    if (!allowedPrefixes.some(prefix => filePath.startsWith(prefix))) {
      const response = NextResponse.json(
        { error: 'Invalid path prefix. Must start with: ' + allowedPrefixes.join(', ') },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate content size (base64 decoded)
    const decodedContent = Buffer.from(content, 'base64');
    if (decodedContent.length > MAX_CONTENT_LENGTH) {
      const response = NextResponse.json(
        { error: 'Content too large (max 10MB)' },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }

    // Verify ClawID signature
    // SDK sends content_hash of RAW content, but content is base64-encoded
    // We need to hash the decoded content to match SDK
    // decodedContent already declared above for size validation
    // Hash decoded (raw) bytes to match CLI's sha256(Buffer.from(rawContent))
    const contentHash = crypto.createHash('sha256').update(decodedContent).digest('hex')
    const payload = { challenge, content_hash: contentHash, path: filePath, timestamp }
    
    // DEBUG: Log exact payload being verified
    console.error('[API] Content hash:', contentHash);
    console.error('[API] Raw content (base64):', content.slice(0, 50) + '...');
    console.error('[API] Verifying payload:', JSON.stringify(payload, Object.keys(payload).sort()));
    console.error('[API] Public key:', public_key);
    console.error('[API] Signature:', signature);
    
    // Diagnostic: Check if clawid_nonces table exists
    const { error: tableError } = await supabase.from('clawid_nonces').select('id', { count: 'exact', head: true }).limit(1)
    console.error('[ClawFS Write] Table check error:', tableError?.message || 'none', 'code:', tableError?.code)
    
    console.error('[ClawFS Write] Verifying signature for:', public_key.slice(0, 16) + '...', 'challenge:', challenge.slice(0, 20) + '...')
    const verification = await verifyClawIDSignature(public_key, signature, payload)
    console.error('[ClawFS Write] Verification result:', verification.valid, 'error:', verification.error)
    
    if (!verification.valid) {
      const response = NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      );
      return applySecurityHeaders(response);
    }

    // Look up agent — check both tables (agents = legacy, agent_registry = new registrations)
    let agent: { agent_id: string } | null = null
    const agentResult = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', public_key)
      .maybeSingle()
    if (!agentResult.error && agentResult.data) {
      agent = agentResult.data as { agent_id: string }
    } else {
      const regResult = await supabase
        .from('agent_registry')
        .select('agent_id')
        .eq('public_key', public_key)
        .maybeSingle()
      if (!regResult.error && regResult.data) {
        agent = regResult.data as { agent_id: string }
      }
    }

    if (!agent) {
      const response = NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
      return applySecurityHeaders(response);
    }

    // Generate CID
    const cid = generateCID(content, public_key)

    // Store file metadata
    const fileResult = await supabase
      .from('clawfs_files')
      .insert({
        agent_id: agent.agent_id,
        public_key,
        path: filePath,
        cid,
        content_type,
        size_bytes: decodedContent.length,
        signature,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()
    
    const file: ClawFSFile | null = fileResult.data

    if (fileResult.error || !file) {
      console.error('Failed to store file:', fileResult.error)
      const response = NextResponse.json(
        { error: 'Failed to write to ClawFS' },
        { status: 500 }
      );
      return applySecurityHeaders(response);
    }

    const response = NextResponse.json({
      success: true,
      file: {
        id: file.id,
        path: file.path,
        cid: file.cid,
        size_bytes: file.size_bytes,
        created_at: file.created_at ?? new Date().toISOString(),
      },
      merkle_root: generateMerkleRoot(cid, public_key),
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('ClawFS write error:', error)
    const response = NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}

function hashContent(content: string): string {
  // Use SHA-256 to match SDK's hashing
  return crypto.createHash('sha256').update(content).digest('hex')
}

function generateCID(content: string, publicKey: string): string {
  const hash = hashContent(content + publicKey)
  return `bafy${hash.slice(0, 44)}`
}

function generateMerkleRoot(cid: string, publicKey: string): string {
  return `bafy${Buffer.from(cid + publicKey).toString('hex').slice(0, 44)}`
}
