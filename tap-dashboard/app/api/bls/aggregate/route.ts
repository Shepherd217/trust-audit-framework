import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { verifyMultiple, verifyAggregateHex } from '@/lib/bls';

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
 * POST /api/bls/aggregate
 * Submit an aggregated attestation signature
 * 
 * Body:
 * {
 *   aggregate_signature: string,  -- hex encoded 96-byte signature
 *   attestation_ids: string[],    -- UUIDs of attestations being aggregated
 *   public_key_indices: number[], -- Indices in the verifier set
 *   submitted_by: string,         -- Agent ID submitting the aggregate
 *   verify_on_submit?: boolean    -- Whether to verify immediately (default: true)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      aggregate_signature, 
      attestation_ids, 
      public_key_indices,
      submitted_by 
    } = body;

    if (!aggregate_signature || !attestation_ids || !public_key_indices || !submitted_by) {
      return NextResponse.json({
        success: false,
        error: 'aggregate_signature, attestation_ids, public_key_indices, and submitted_by required'
      }, { status: 400 });
    }

    // Validate signature format
    const sigHex = aggregate_signature.replace(/^0x/, '');
    if (sigHex.length !== 192) {
      return NextResponse.json({
        success: false,
        error: 'Invalid aggregate signature length. Expected 96 bytes.'
      }, { status: 400 });
    }

    // Verify submitter is active
    const { data: agent } = await getSupabase()
      .from('agent_registry')
      .select('activation_status, reputation')
      .eq('agent_id', submitted_by)
      .single();

    if (!agent || agent.activation_status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Submitter must be an active agent'
      }, { status: 403 });
    }

    // Check BLS verification is enabled
    const { data: config } = await getSupabase()
      .from('wot_config')
      .select('bls_verification_enabled')
      .eq('id', 1)
      .single();

    const verifyOnSubmit = body.verify_on_submit !== false; // Default true
    let verificationResult: { valid: boolean; details?: any; duration_ms?: number } | null = null;

    // Perform BLS verification if enabled and requested
    if (config?.bls_verification_enabled && verifyOnSubmit) {
      const verifyStart = performance.now();
      
      try {
        // Fetch attestations and their BLS keys
        const { data: attestations, error: attError } = await getSupabase()
          .from('attestations')
          .select('id, claim, target_agent_id')
          .in('id', attestation_ids);

        if (attError) throw new Error('Failed to fetch attestations: ' + attError.message);

        // Get BLS keys for the attesting agents
        const agentIds = [...new Set(attestations?.map((a: any) => a.target_agent_id) || [])];
        const { data: blsKeys } = await getSupabase()
          .from('bls_keypairs')
          .select('agent_id, public_key')
          .in('agent_id', agentIds)
          .eq('key_type', 'attestation')
          .is('revoked_at', null);

        const keyMap = new Map(blsKeys?.map((k: any) => [
          k.agent_id,
          Buffer.from(k.public_key).toString('hex')
        ]) || []);

        // Build arrays for BLS verification
        const messages: string[] = [];
        const publicKeys: string[] = [];
        const missingKeys: string[] = [];

        for (const att of attestations || []) {
          const pk = keyMap.get(att.target_agent_id);
          if (!pk) {
            missingKeys.push(att.target_agent_id);
            continue;
          }
          messages.push(att.claim);
          publicKeys.push(pk);
        }

        // Verify if we have all keys
        if (missingKeys.length > 0) {
          verificationResult = {
            valid: false,
            details: {
              error: 'Missing BLS keys for agents',
              missing_agents: missingKeys,
              attestation_count: attestation_ids.length,
              verifiable_count: publicKeys.length
            },
            duration_ms: Math.round((performance.now() - verifyStart) * 100) / 100
          };
        } else if (publicKeys.length > 0) {
          // Perform real BLS verification
          const valid = await verifyAggregateHex(messages, sigHex, publicKeys);
          verificationResult = {
            valid,
            details: {
              signer_count: publicKeys.length,
              unique_claims: new Set(messages).size,
              all_keys_found: true
            },
            duration_ms: Math.round((performance.now() - verifyStart) * 100) / 100
          };
        }
      } catch (verifyError) {
        console.error('BLS verification error:', verifyError);
        verificationResult = {
          valid: false,
          details: { error: (verifyError as Error).message },
          duration_ms: Math.round((performance.now() - verifyStart) * 100) / 100
        };
      }
    }

    // Insert aggregate with verification result if available
    const { data: aggregate, error } = await getSupabase()
      .from('aggregated_attestations')
      .insert([{
        aggregate_signature: Buffer.from(sigHex, 'hex'),
        attestation_count: attestation_ids.length,
        attestation_ids,
        public_key_indices,
        valid: verificationResult?.valid ?? null,
        verified_at: verificationResult ? new Date().toISOString() : null,
        verified_by: verificationResult ? 'bls_automated' : null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      aggregate_id: aggregate.id,
      attestation_count: attestation_ids.length,
      bls_verification_enabled: config?.bls_verification_enabled || false,
      verified: verificationResult?.valid ?? null,
      verification: verificationResult,
      message: verificationResult 
        ? (verificationResult.valid 
            ? `Aggregate verified: ${verificationResult.details?.signer_count || 0} signers, ${verificationResult.duration_ms}ms`
            : `Aggregate verification failed: ${verificationResult.details?.error || 'invalid signature'}`)
        : 'Aggregate submitted. Verification skipped (disabled or requested).'
    });

  } catch (error) {
    console.error('Aggregate submit error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to submit aggregate'
    }, { status: 500 });
  }
}

/**
 * GET /api/bls/aggregate
 * Get aggregated attestations
 * 
 * Query:
 *   aggregate_id: specific aggregate
 *   verified_only: boolean
 *   limit: number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const aggregateId = searchParams.get('aggregate_id');
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

    if (aggregateId) {
      const { data, error } = await getSupabase()
        .from('aggregated_attestations')
        .select(`
          *,
          shares:signature_shares(count)
        `)
        .eq('id', aggregateId)
        .single();

      if (error || !data) {
        return NextResponse.json({
          success: false,
          error: 'Aggregate not found'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        aggregate: {
          ...data,
          aggregate_signature: Buffer.from(data.aggregate_signature).toString('hex')
        }
      });
    }

    let query = getSupabase()
      .from('aggregated_attestations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (verifiedOnly) {
      query = query.eq('valid', true).not('verified_at', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch aggregates'
      }, { status: 500 });
    }

    const aggregates = data?.map((a: any) => ({
      ...a,
      aggregate_signature: Buffer.from(a.aggregate_signature).toString('hex')
    })) || [];

    return NextResponse.json({
      success: true,
      aggregates,
      count: aggregates.length
    });

  } catch (error) {
    console.error('Aggregate fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch aggregates'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/bls/aggregate
 * Mark aggregate as verified (admin only or automated verifier)
 * 
 * Body:
 * {
 *   aggregate_id: string,
 *   valid: boolean,
 *   verifier_id: string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { aggregate_id, valid, verifier_id } = body;

    if (!aggregate_id || valid === undefined || !verifier_id) {
      return NextResponse.json({
        success: false,
        error: 'aggregate_id, valid, and verifier_id required'
      }, { status: 400 });
    }

    // Verify verifier is genesis or high-reputation
    const { data: verifier } = await getSupabase()
      .from('agent_registry')
      .select('reputation, is_genesis')
      .eq('agent_id', verifier_id)
      .single();

    if (!verifier || (!verifier.is_genesis && verifier.reputation < 5000)) {
      return NextResponse.json({
        success: false,
        error: 'Verifier must be genesis or have 5000+ reputation'
      }, { status: 403 });
    }

    const { data, error } = await getSupabase()
      .from('aggregated_attestations')
      .update({
        valid,
        verified_at: new Date().toISOString(),
        verified_by: verifier_id
      })
      .eq('id', aggregate_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      aggregate_id,
      valid,
      verified_by: verifier_id,
      message: valid ? 'Aggregate verified successfully' : 'Aggregate marked invalid'
    });

  } catch (error) {
    console.error('Aggregate verify error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to verify aggregate'
    }, { status: 500 });
  }
}
