export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';

let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/clawfs/evidence
 * Upload evidence metadata (actual file stored externally, e.g., IPFS, S3)
 * 
 * Body:
 * {
 *   bucket_id: string,  -- Or auto-created from bucket_type + related_id
 *   bucket_type: 'dispute' | 'appeal' | 'anomaly' | 'honeypot',
 *   related_id: string, -- dispute_id, appeal_id, etc.
 *   cid: string,        -- Content identifier (IPFS hash, etc.)
 *   evidence_type: 'document' | 'screenshot' | 'log' | 'transaction' | 'signature' | 'recording',
 *   filename: string,
 *   mime_type: string,
 *   size_bytes: number,
 *   hash_sha256: string,  -- hex encoded
 *   uploaded_by: string,  -- agent_id
 *   metadata?: object
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bucket_id,
      bucket_type,
      related_id,
      cid,
      evidence_type,
      filename,
      mime_type,
      size_bytes,
      hash_sha256,
      uploaded_by,
      metadata = {}
    } = body;

    if (!cid || !evidence_type || !hash_sha256 || !uploaded_by) {
      return NextResponse.json({
        success: false,
        error: 'cid, evidence_type, hash_sha256, and uploaded_by required'
      }, { status: 400 });
    }

    // Validate evidence type
    const validTypes = ['document', 'screenshot', 'log', 'transaction', 'signature', 'recording'];
    if (!validTypes.includes(evidence_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid evidence_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Check limits
    const { data: config } = await getSupabase()
      .from('wot_config')
      .select('max_evidence_size_mb, max_evidence_items')
      .eq('id', 1)
      .maybeSingle();

    const maxSize = (config?.max_evidence_size_mb || 100) * 1024 * 1024;
    const maxItems = config?.max_evidence_items || 50;

    if (size_bytes > maxSize) {
      return NextResponse.json({
        success: false,
        error: `File size exceeds limit of ${config?.max_evidence_size_mb || 100}MB`
      }, { status: 400 });
    }

    // Get or create bucket
    let targetBucketId = bucket_id;
    
    if (!targetBucketId && bucket_type && related_id) {
      // Check if bucket exists
      const { data: existing } = await getSupabase()
        .from('clawfs_buckets')
        .select('id, locked_at')
        .eq('bucket_type', bucket_type)
        .eq('related_id', related_id)
        .maybeSingle();

      if (existing?.locked_at) {
        return NextResponse.json({
          success: false,
          error: 'Evidence bucket is locked. No more uploads allowed.'
        }, { status: 403 });
      }

      if (existing) {
        targetBucketId = existing.id;
      } else {
        // Create new bucket
        const { data: newBucket, error: bucketError } = await getSupabase()
          .rpc('create_evidence_bucket' as any, {
            p_bucket_type: bucket_type,
            p_related_id: related_id,
            p_owner_id: uploaded_by
          } as any);

        if (bucketError) throw bucketError;
        targetBucketId = newBucket;
      }
    }

    if (!targetBucketId) {
      return NextResponse.json({
        success: false,
        error: 'bucket_id or (bucket_type + related_id) required'
      }, { status: 400 });
    }

    // Check bucket not locked
    const { data: bucket } = await getSupabase()
      .from('clawfs_buckets')
      .select('locked_at, owner_id')
      .eq('id', targetBucketId)
      .maybeSingle();

    if (bucket?.locked_at) {
      return NextResponse.json({
        success: false,
        error: 'Evidence bucket is locked'
      }, { status: 403 });
    }

    // Count existing items
    const { count } = await getSupabase()
      .from('clawfs_evidence')
      .select('*', { count: 'exact', head: true })
      .eq('bucket_id', targetBucketId);

    if ((count ?? 0) >= maxItems) {
      return NextResponse.json({
        success: false,
        error: `Maximum ${maxItems} evidence items per bucket`
      }, { status: 400 });
    }

    // Insert evidence record
    const hashBytes = Buffer.from(hash_sha256.replace(/^0x/, ''), 'hex');
    
    const { data: evidence, error } = await getSupabase()
      .from('clawfs_evidence')
      .insert([{
        bucket_id: targetBucketId,
        cid,
        evidence_type,
        filename,
        mime_type,
        size_bytes,
        hash_sha256: hashBytes,
        uploaded_by,
        metadata
      }])
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {  // unique violation on CID
        return NextResponse.json({
          success: false,
          error: 'Evidence with this CID already exists'
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      evidence_id: evidence.id,
      bucket_id: targetBucketId,
      cid,
      message: 'Evidence registered successfully'
    });

  } catch (error) {
    console.error('Evidence upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to register evidence'
    }, { status: 500 });
  }
}

/**
 * GET /api/clawfs/evidence
 * Retrieve evidence metadata
 * 
 * Query:
 *   evidence_id: specific item
 *   bucket_id: all items in bucket
 *   cid: lookup by content ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get('evidence_id');
    const bucketId = searchParams.get('bucket_id');
    const cid = searchParams.get('cid');
    const accessorId = searchParams.get('accessor_id');  // for audit log

    if (evidenceId) {
      const { data, error } = await getSupabase()
        .from('clawfs_evidence')
        .select(`
          *,
          bucket:bucket_id (*),
          uploader:uploaded_by (agent_id, name)
        `)
        .eq('id', evidenceId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Evidence not found'
        }, { status: 404 });
      }

      // Log access if accessor provided
      if (accessorId) {
        await getSupabase()
          .from('clawfs_access_log')
          .insert([{
            evidence_id: evidenceId,
            accessed_by: accessorId,
            access_type: 'read'
          }]);
      }

      return NextResponse.json({
        success: true,
        evidence: {
          ...data,
          hash_sha256: Buffer.from(data.hash_sha256).toString('hex')
        }
      });
    }

    if (cid) {
      const { data, error } = await getSupabase()
        .from('clawfs_evidence')
        .select(`
          *,
          bucket:bucket_id (*),
          uploader:uploaded_by (agent_id, name)
        `)
        .eq('cid', cid)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Evidence not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        evidence: {
          ...data,
          hash_sha256: Buffer.from(data.hash_sha256).toString('hex')
        }
      });
    }

    if (bucketId) {
      const { data, error } = await getSupabase()
        .from('clawfs_evidence')
        .select(`
          *,
          uploader:uploaded_by (agent_id, name)
        `)
        .eq('bucket_id', bucketId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch evidence'
        }, { status: 500 });
      }

      const evidence = data?.map((e: any) => ({
        ...e,
        hash_sha256: Buffer.from(e.hash_sha256).toString('hex')
      })) || [];

      return NextResponse.json({
        success: true,
        bucket_id: bucketId,
        evidence,
        count: evidence.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'evidence_id, bucket_id, or cid required'
    }, { status: 400 });

  } catch (error) {
    console.error('Evidence fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch evidence'
    }, { status: 500 });
  }
}
