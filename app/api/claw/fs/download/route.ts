/**
 * @fileoverview ClawFS Download API
 * @description GET /api/claw/fs/download - Download files by path or CID
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getClawFS, 
  ClawFSError,
  FileMetadata 
} from '@/lib/claw/fs';

// ============================================================================
// TYPES
// ============================================================================

interface DownloadResponse {
  success: boolean;
  file?: {
    metadata: Record<string, unknown>;
    data: string; // Base64 encoded
  };
  stream?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// MAIN HANDLER - GET /api/claw/fs/download
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const identifier = searchParams.get('path') || searchParams.get('cid');
    const requester = searchParams.get('requester');
    const format = searchParams.get('format') || 'base64'; // 'base64', 'json', or 'stream'

    // Validation
    if (!identifier) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'IDENTIFIER_REQUIRED',
          message: 'File identifier required. Provide ?path= or ?cid= parameter',
        },
      }, { status: 400 });
    }

    if (!requester) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'REQUESTER_REQUIRED',
          message: 'Requester (agent ID) is required',
        },
      }, { status: 400 });
    }

    const clawfs = getClawFS();

    // Download file
    const { data, metadata } = await clawfs.download(identifier, requester);

    // Handle different response formats
    if (format === 'stream') {
      // Return raw binary stream
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': metadata.mimeType,
          'Content-Length': String(data.length),
          'Content-Disposition': `attachment; filename="${metadata.name}"`,
          'X-CID': metadata.cid,
          'X-File-Path': metadata.path,
          'X-Storage-Tier': metadata.tier,
        },
      });
    }

    // Default: return base64 encoded with metadata
    const base64Data = data.toString('base64');

    return NextResponse.json({
      success: true,
      file: {
        metadata: serializeMetadata(metadata),
        data: base64Data,
      },
    });

  } catch (error) {
    console.error('[ClawFS Download Error]:', error);
    
    if (error instanceof ClawFSError) {
      const statusCode = error.code === 'FILE_NOT_FOUND' ? 404 : 
                        error.code === 'ACCESS_DENIED' ? 403 : 400;
      
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }, { status: statusCode });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }, { status: 500 });
  }
}

// ============================================================================
// HEAD /api/claw/fs/download
// Check file existence and get metadata without downloading
// ============================================================================

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const identifier = searchParams.get('path') || searchParams.get('cid');
    const requester = searchParams.get('requester');

    if (!identifier || !requester) {
      return new NextResponse(null, { status: 400 });
    }

    const clawfs = getClawFS();
    const metadata = await clawfs.getMetadata(identifier, requester);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': metadata.mimeType,
        'Content-Length': String(metadata.size),
        'X-CID': metadata.cid,
        'X-File-Path': metadata.path,
        'X-Storage-Tier': metadata.tier,
        'X-Owner': metadata.owner,
        'X-Access-Count': String(metadata.accessCount),
        'X-Last-Accessed': metadata.accessedAt.toISOString(),
        'X-Created': metadata.createdAt.toISOString(),
      },
    });

  } catch (error) {
    if (error instanceof ClawFSError) {
      const statusCode = error.code === 'FILE_NOT_FOUND' ? 404 : 
                        error.code === 'ACCESS_DENIED' ? 403 : 400;
      return new NextResponse(null, { status: statusCode });
    }
    return new NextResponse(null, { status: 500 });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function serializeMetadata(metadata: FileMetadata): Record<string, unknown> {
  return {
    cid: metadata.cid,
    name: metadata.name,
    path: metadata.path,
    size: metadata.size,
    mimeType: metadata.mimeType,
    tier: metadata.tier,
    owner: metadata.owner,
    createdAt: metadata.createdAt.toISOString(),
    modifiedAt: metadata.modifiedAt.toISOString(),
    accessedAt: metadata.accessedAt.toISOString(),
    accessCount: metadata.accessCount,
    tags: metadata.tags,
    sharedWith: metadata.sharedWith,
    permissions: metadata.permissions,
    expiresAt: metadata.expiresAt?.toISOString(),
    replicas: metadata.replicas.map(r => ({
      nodeId: r.nodeId,
      tier: r.tier,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
