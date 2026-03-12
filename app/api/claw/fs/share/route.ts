/**
 * @fileoverview ClawFS Share API
 * @description PUT /api/claw/fs/share - Manage file sharing permissions
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getClawFS, 
  ClawFSError,
  FileMetadata,
  FilePermissions 
} from '@/lib/claw/fs';

// ============================================================================
// TYPES
// ============================================================================

interface ShareRequest {
  action: 'grant' | 'revoke' | 'list';
  path?: string;
  cid?: string;
  owner: string;
  agentIds?: string[];
  permissions?: Partial<FilePermissions>;
  expiresInDays?: number;
}

interface ShareResponse {
  success: boolean;
  file?: Record<string, unknown>;
  shares?: Array<{
    agentId: string;
    permissions: string[];
    grantedAt: string;
  }>;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// MAIN HANDLER - PUT /api/claw/fs/share
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ShareRequest = await request.json();

    // Validate required fields
    if (!body.path && !body.cid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'IDENTIFIER_REQUIRED',
          message: 'File path or CID is required',
        },
      }, { status: 400 });
    }

    if (!body.owner) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'OWNER_REQUIRED',
          message: 'Owner (agent ID) is required',
        },
      }, { status: 400 });
    }

    const identifier = body.path || body.cid!;
    const clawfs = getClawFS();

    switch (body.action) {
      case 'grant':
        return handleGrantShare(clawfs, identifier, body);
      
      case 'revoke':
        return handleRevokeShare(clawfs, identifier, body);
      
      case 'list':
        return handleListShares(clawfs, identifier, body);
      
      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: `Invalid action: ${body.action}. Use 'grant', 'revoke', or 'list'`,
          },
        }, { status: 400 });
    }

  } catch (error) {
    console.error('[ClawFS Share Error]:', error);
    
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
// ACTION HANDLERS
// ============================================================================

async function handleGrantShare(
  clawfs: ReturnType<typeof getClawFS>,
  identifier: string,
  body: ShareRequest
): Promise<NextResponse> {
  if (!body.agentIds || body.agentIds.length === 0) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENTS_REQUIRED',
        message: 'At least one agent ID is required to grant share',
      },
    }, { status: 400 });
  }

  const metadata = await clawfs.share(identifier, body.owner, {
    agentIds: body.agentIds,
    permissions: body.permissions,
    expiresInDays: body.expiresInDays,
  });

  return NextResponse.json({
    success: true,
    file: serializeMetadata(metadata),
    message: `File shared with ${body.agentIds.length} agent(s)`,
  });
}

async function handleRevokeShare(
  clawfs: ReturnType<typeof getClawFS>,
  identifier: string,
  body: ShareRequest
): Promise<NextResponse> {
  if (!body.agentIds || body.agentIds.length === 0) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'AGENTS_REQUIRED',
        message: 'At least one agent ID is required to revoke share',
      },
    }, { status: 400 });
  }

  const metadata = await clawfs.revokeShare(identifier, body.owner, body.agentIds);

  return NextResponse.json({
    success: true,
    file: serializeMetadata(metadata),
    message: `Access revoked for ${body.agentIds.length} agent(s)`,
  });
}

async function handleListShares(
  clawfs: ReturnType<typeof getClawFS>,
  identifier: string,
  body: ShareRequest
): Promise<NextResponse> {
  const metadata = await clawfs.getMetadata(identifier, body.owner);

  const shares = metadata.sharedWith.map(agentId => ({
    agentId,
    permissions: ['read'], // Shared agents currently get read-only
    grantedAt: metadata.modifiedAt.toISOString(),
  }));

  return NextResponse.json({
    success: true,
    file: {
      cid: metadata.cid,
      path: metadata.path,
      owner: metadata.owner,
    },
    shares,
  });
}

// ============================================================================
// GET /api/claw/fs/share
// Query share information
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    const path = searchParams.get('path');
    const cid = searchParams.get('cid');
    const requester = searchParams.get('requester');

    const identifier = path || cid;

    if (!identifier) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'IDENTIFIER_REQUIRED',
          message: 'File path or CID is required',
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
    const metadata = await clawfs.getMetadata(identifier, requester);

    // Only owner or shared agents can see share info
    const isOwner = metadata.owner === requester;
    const isShared = metadata.sharedWith.includes(requester);

    if (!isOwner && !isShared) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to view share information',
        },
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      file: {
        cid: metadata.cid,
        path: metadata.path,
        name: metadata.name,
        owner: metadata.owner,
      },
      access: {
        isOwner,
        isShared,
        permissions: isOwner ? ['read', 'write', 'delete', 'share'] : ['read'],
      },
      shares: isOwner ? metadata.sharedWith.map(agentId => ({
        agentId,
        permissions: ['read'],
        grantedAt: metadata.modifiedAt.toISOString(),
      })) : undefined,
    });

  } catch (error) {
    console.error('[ClawFS Share Query Error]:', error);
    
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
  };
}
