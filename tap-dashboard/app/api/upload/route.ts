export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Rate limit: 10 uploads per minute per IP
const MAX_FILE_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// POST /api/upload - Upload a file (avatar, etc.)
export async function POST(request: NextRequest) {
  const path = '/api/upload';
  
  // Apply rate limiting
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return applySecurityHeaders(response);
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validate token format (JWT structure)
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      const response = NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
      return applySecurityHeaders(response);
    }
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return applySecurityHeaders(response);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      const response = NextResponse.json({ error: 'No file provided' }, { status: 400 });
      return applySecurityHeaders(response);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      const response = NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE_MB}MB)` },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      const response = NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate file name (prevent path traversal)
    const fileNameParts = file.name.split('.');
    const fileExt = fileNameParts.pop()?.toLowerCase();
    
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      const response = NextResponse.json(
        { error: 'Invalid file extension' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    // Sanitize filename (remove special chars)
    const baseName = fileNameParts.join('.').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    if (!baseName) {
      const response = NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const fileName = `${user.id}/${timestamp}_${randomSuffix}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('Storage upload error:', error);
      const response = NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      return applySecurityHeaders(response);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const response = NextResponse.json({ 
      success: true,
      url: publicUrl,
      fileName: fileName,
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Unexpected error:', error);
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return applySecurityHeaders(response);
  }
}
