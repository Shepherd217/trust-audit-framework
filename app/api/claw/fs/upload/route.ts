/**
 * @fileoverview ClawFS Upload API
 * @description POST /api/claw/fs/upload - Upload files with content-addressed storage
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getClawFS, 
  ClawFSError, 
  UploadOptions,
  StorageTier,
  FileMetadata 
} from '@/lib/claw/fs';

// ============================================================================
// TYPES
// ============================================================================

interface UploadResponse {
  success: boolean;
  file?: FileMetadata;
  cid?: string;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

interface UploadRequestBody {
  path: string;
  content: string; // Base64 encoded
  owner: string;
  options?: {
    tier?: StorageTier;
    encrypt?: boolean;
    tags?: string[];
    expiresInDays?: number;
  };
}

// ============================================================================
// MAIN HANDLER - POST /api/claw/fs/upload
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle multipart/form-data for binary uploads
    if (contentType.includes('multipart/form-data')) {
      return handleMultipartUpload(request);
    }
    
    // Handle JSON uploads
    return handleJSONUpload(request);
  } catch (error) {
    console.error('[ClawFS Upload Error]:', error);
    
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
// UPLOAD HANDLERS
// ============================================================================

async function handleMultipartUpload(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  
  // Extract file
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'FILE_REQUIRED',
        message: 'No file provided in form data',
      },
    }, { status: 400 });
  }

  // Extract metadata
  const path = formData.get('path') as string || file.name;
  const owner = formData.get('owner') as string;
  
  if (!owner) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'OWNER_REQUIRED',
        message: 'Owner (agent ID) is required',
      },
    }, { status: 400 });
  }

  // Parse options
  const tier = formData.get('tier') as StorageTier | null;
  const encrypt = formData.get('encrypt') === 'true';
  const tags = formData.get('tags') as string;
  const expiresInDays = formData.get('expiresInDays') as string;

  const options: UploadOptions = {
    tier: tier || undefined,
    encrypt,
    tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
    expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
  };

  // Read file content
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to ClawFS
  const clawfs = getClawFS();
  const metadata = await clawfs.upload(path, buffer, owner, options);

  return NextResponse.json({
    success: true,
    file: serializeMetadata(metadata),
    cid: metadata.cid,
    message: 'File uploaded successfully',
  }, { status: 201 });
}

async function handleJSONUpload(request: NextRequest): Promise<NextResponse> {
  const body: UploadRequestBody = await request.json();
  
  // Validate required fields
  if (!body.path) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'PATH_REQUIRED',
        message: 'File path is required',
      },
    }, { status: 400 });
  }

  if (!body.content) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CONTENT_REQUIRED',
        message: 'File content is required',
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

  // Decode base64 content
  let buffer: Buffer;
  try {
    buffer = Buffer.from(body.content, 'base64');
  } catch {
    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_CONTENT',
        message: 'Content must be valid base64',
      },
    }, { status: 400 });
  }

  // Upload to ClawFS
  const clawfs = getClawFS();
  const options: UploadOptions = {
    tier: body.options?.tier,
    encrypt: body.options?.encrypt,
    tags: body.options?.tags,
    expiresInDays: body.options?.expiresInDays,
  };

  const metadata = await clawfs.upload(body.path, buffer, body.owner, options);

  return NextResponse.json({
    success: true,
    file: serializeMetadata(metadata),
    cid: metadata.cid,
    message: 'File uploaded successfully',
  }, { status: 201 });
}

// ============================================================================
// GET /api/claw/fs/upload
// Get upload info and limits
// ============================================================================

export async function GET(): Promise<NextResponse> {
  const clawfs = getClawFS();
  const stats = await clawfs.getStats();

  return NextResponse.json({
    limits: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxHotSize: 100 * 1024 * 1024,  // 100MB
      maxWarmSize: 1024 * 1024 * 1024, // 1GB
    },
    tiers: {
      hot: {
        description: 'Frequently accessed, local SSD/memory',
        retentionDays: 7,
        currentUsage: stats.byTier.hot,
      },
      warm: {
        description: 'Occasionally accessed, local disk',
        retentionDays: 30,
        currentUsage: stats.byTier.warm,
      },
      cold: {
        description: 'Rarely accessed, compressed storage',
        retentionDays: null,
        currentUsage: stats.byTier.cold,
      },
    },
    stats: {
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
    },
  });
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
