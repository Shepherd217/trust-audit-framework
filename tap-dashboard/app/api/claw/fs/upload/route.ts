/**
 * ============================================================================
 * ClawFS Upload API Route
 * ============================================================================
 * 
 * POST /api/claw/fs/upload
 * 
 * Multipart form data upload for files.
 * 
 * Form fields:
 * - file: The file to upload (required)
 * - name: Display name (optional, defaults to filename)
 * - mimeType: MIME type (optional, auto-detected)
 * - tier: Storage tier - 'hot', 'warm', 'cold' (optional, default: 'warm')
 * - shareWith: Comma-separated agent IDs to share with (optional)
 * - expiresIn: Expiration duration - '1d', '7d', '30d', '90d', '1y' (optional)
 * - tags: Comma-separated tags (optional)
 * - description: File description (optional)
 * 
 * Headers:
 * - X-Agent-Id: Agent ID making the request (required)
 * 
 * @module app/api/claw/fs/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { write, calculateCID } from '@/lib/claw/fs';
import { toClawFileDTO, WriteFileInput, StorageTier } from '@/lib/claw/fs/types';

export async function POST(request: NextRequest) {
  try {
    // Get agent ID from header
    const agentId = request.headers.get('X-Agent-Id');
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'X-Agent-Id header is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // Get optional parameters
    const name = formData.get('name') as string || file.name;
    const mimeType = formData.get('mimeType') as string || file.type || undefined;
    const tier = (formData.get('tier') as StorageTier) || 'warm';
    const shareWithStr = formData.get('shareWith') as string;
    const shareWith = shareWithStr ? shareWithStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const expiresIn = formData.get('expiresIn') as string | undefined;
    const tagsStr = formData.get('tags') as string;
    const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const description = formData.get('description') as string | undefined;

    // Validate tier
    if (!['hot', 'warm', 'cold'].includes(tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid tier: ${tier}`, code: 'INVALID_TIER' },
        { status: 400 }
      );
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build input
    const input: WriteFileInput = {
      name,
      data: buffer,
      mimeType: mimeType || undefined,
      tier,
      shareWith,
      expiresIn,
      tags,
      description,
    };

    // Write file
    const clawFile = await write(input, agentId);

    return NextResponse.json({
      success: true,
      file: toClawFileDTO(clawFile),
      cid: clawFile.cid,
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('too large')) {
        return NextResponse.json(
          { success: false, error: error.message, code: 'FILE_TOO_LARGE' },
          { status: 413 }
        );
      }
      if (error.message.includes('Invalid')) {
        return NextResponse.json(
          { success: false, error: error.message, code: 'INVALID_INPUT' },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: (error as Error).message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable built-in body parser for multipart
  },
};
