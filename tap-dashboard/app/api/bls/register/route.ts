export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
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
 * POST /api/bls/register
 * Register a BLS public key for an agent
 * 
 * Body:
 * {
 *   agent_id: string,
 *   public_key: string,  -- hex encoded 96-byte BLS12-381 public key
 *   key_type: 'attestation' | 'governance' | 'recovery'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_id, public_key, key_type = 'attestation' } = body;

    if (!agent_id || !public_key) {
      return NextResponse.json({
        success: false,
        error: 'agent_id and public_key required'
      }, { status: 400 });
    }

    // Validate public key format (96 bytes = 192 hex chars)
    const pkHex = public_key.replace(/^0x/, '');
    if (pkHex.length !== 192) {
      return NextResponse.json({
        success: false,
        error: 'Invalid BLS public key length. Expected 96 bytes (192 hex chars).'
      }, { status: 400 });
    }

    // Convert hex to bytes
    const pkBytes = Buffer.from(pkHex, 'hex');

    // Verify agent exists and is active
    const { data: agent } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, activation_status')
      .eq('agent_id', agent_id)
      .maybeSingle();

    if (!agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 });
    }

    if (agent.activation_status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Agent must be active to register BLS key'
      }, { status: 400 });
    }

    // Insert key (upsert if same key_type exists)
    const { data: keypair, error } = await getSupabase()
      .from('bls_keypairs')
      .upsert([{
        agent_id,
        public_key: pkBytes,
        key_type,
        rotated_at: new Date().toISOString()
      }], { onConflict: 'agent_id,key_type' })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      key_id: keypair.id,
      agent_id,
      key_type,
      public_key: pkHex,
      message: 'BLS public key registered successfully'
    });

  } catch (error) {
    console.error('BLS registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to register BLS key'
    }, { status: 500 });
  }
}

/**
 * GET /api/bls/register
 * Get BLS keys for an agent
 * 
 * Query: agent_id required
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'agent_id required'
      }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('bls_keypairs')
      .select('*')
      .eq('agent_id', agentId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch BLS keys'
      }, { status: 500 });
    }

    // Convert bytes to hex for JSON response
    const keys = data?.map((k: any) => ({
      ...k,
      public_key: Buffer.from(k.public_key).toString('hex')
    })) || [];

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      keys,
      count: keys.length
    });

  } catch (error) {
    console.error('BLS fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch BLS keys'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/bls/register
 * Revoke a BLS key
 * 
 * Body:
 * {
 *   key_id: string,
 *   agent_id: string  -- for authorization
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { key_id, agent_id } = body;

    if (!key_id || !agent_id) {
      return NextResponse.json({
        success: false,
        error: 'key_id and agent_id required'
      }, { status: 400 });
    }

    // Verify ownership
    const { data: key } = await getSupabase()
      .from('bls_keypairs')
      .select('agent_id')
      .eq('id', key_id)
      .maybeSingle();

    if (!key || key.agent_id !== agent_id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized or key not found'
      }, { status: 403 });
    }

    const { error } = await getSupabase()
      .from('bls_keypairs')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', key_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'BLS key revoked successfully'
    });

  } catch (error) {
    console.error('BLS revoke error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to revoke BLS key'
    }, { status: 500 });
  }
}
