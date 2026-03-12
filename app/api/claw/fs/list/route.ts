/**
 * @fileoverview ClawFS List API
 * @description GET /api/claw/fs/list - List files with filtering and pagination
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getClawFS, 
  ClawFSError,
  FileMetadata,
  StorageTier 
} from '@/lib/claw/fs';

// ============================================================================
// TYPES
// ============================================================================

interface ListResponse {
  success: boolean;
  files?: Array<Record<string, unknown>>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats?: {
    totalFiles: number;
    totalSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// MAIN HANDLER - GET /api/claw/fs/list
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const owner = searchParams.get('owner');
    const tier = searchParams.get('tier') as StorageTier | null;
    const path = searchParams.get('path');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const recursive = searchParams.get('recursive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // At least owner or path should be specified for reasonable results
    if (!owner && !path) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FILTER_REQUIRED',
          message: 'At least owner or path filter is required',
        },
      }, { status: 400 });
    }

    const clawfs = getClawFS();

    // Get all matching files
    const allFiles = await clawfs.list({
      owner: owner || undefined,
      tier: tier || undefined,
      path: path || undefined,
      tags: tags || undefined,
      recursive,
    });

    // Apply pagination
    const total = allFiles.length;
    const paginatedFiles = allFiles.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Get stats for context
    const stats = await clawfs.getStats();

    return NextResponse.json({
      success: true,
      files: paginatedFiles.map(serializeMetadata),
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
      stats: {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
      },
    });

  } catch (error) {
    console.error('[ClawFS List Error]:', error);
    
    if (error instanceof ClawFSError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }, { status: 400 });
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
// DELETE /api/claw/fs/list
// Bulk delete files
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const paths = body.paths || searchParams.get('paths')?.split(',').filter(Boolean);
    const owner = body.owner || searchParams.get('owner');

    if (!paths || paths.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PATHS_REQUIRED',
          message: 'File paths to delete are required',
        },
      }, { status: 400 });
    }

    if (!owner) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'OWNER_REQUIRED',
          message: 'Owner (agent ID) is required',
        },
      }, { status: 400 });
    }

    const clawfs = getClawFS();
    const results = {
      deleted: [] as string[],
      failed: [] as Array<{ path: string; error: string }>,
    };

    for (const path of paths) {
      try {
        const deleted = await clawfs.delete(path, owner);
        if (deleted) {
          results.deleted.push(path);
        } else {
          results.failed.push({ path, error: 'File not found' });
        }
      } catch (error) {
        results.failed.push({ 
          path, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: results.failed.length === 0,
      results,
      message: `Deleted ${results.deleted.length} file(s), ${results.failed.length} failed`,
    });

  } catch (error) {
    console.error('[ClawFS Bulk Delete Error]:', error);
    
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
    expiresAt: metadata.expiresAt?.toISOString(),
  };
}
