export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { 
  verify, 
  verifyAggregate, 
  verifyMultiple,
  verifyHex,
  verifyAggregateHex 
} from '@/lib/bls';
import { 
  applyRateLimit, 
  applySecurityHeaders,
  validateBodySize,
  validateArrayLength,
  validateHex 
} from '@/lib/security';

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

// Configuration limits
const MAX_MESSAGE_LENGTH = 10000; // 10KB max message
const MAX_SIGNERS = 1000; // Max signers for aggregate verification
const MAX_ATTESTATION_IDS = 500; // Max attestations to fetch

/**
 * POST /api/bls/verify
 * Verify BLS signatures (single, aggregate, or batch)
 * Rate limited: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  // Apply rate limiting
  const path = '/api/bls/verify';
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    const bodyText = await request.text();
    
    // Validate body size (100KB max)
    const sizeCheck = validateBodySize(bodyText, 100);
    if (!sizeCheck.valid) {
      return NextResponse.json({
        success: false,
        error: sizeCheck.error
      }, { status: 413 });
    }
    
    const body = JSON.parse(bodyText);
    const { mode } = body;

    if (!mode) {
      return NextResponse.json({
        success: false,
        error: 'mode is required (single|aggregate|multiple|by_attestations)'
      }, { status: 400 });
    }

    let result: { valid: boolean; details?: any };

    switch (mode) {
      case 'single':
        result = await verifySingle(body);
        break;
      case 'aggregate':
        result = await verifyAggregateMode(body);
        break;
      case 'multiple':
        result = await verifyMultipleMode(body);
        break;
      case 'by_attestations':
        result = await verifyByAttestations(body);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `Invalid mode: ${mode}. Use: single, aggregate, multiple, by_attestations`
        }, { status: 400 });
    }

    const duration = performance.now() - startTime;

    const response = NextResponse.json({
      success: true,
      valid: result.valid,
      mode,
      verification_time_ms: Math.round(duration * 100) / 100,
      details: result.details,
      message: result.valid 
        ? 'Signature verified successfully'
        : 'Signature verification failed'
    });
    
    // Add rate limit headers
    
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('BLS verify error:', error);
    const response = NextResponse.json({
      success: false,
      error: 'Verification failed: ' + (error as Error).message
    }, { status: 500 });
    
    return applySecurityHeaders(response);
  }
}

async function verifySingle(body: any): Promise<{ valid: boolean; details: any }> {
  const { message, signature, public_key } = body;

  if (!message || !signature || !public_key) {
    throw new Error('message, signature, and public_key required for single mode');
  }

  // Validate message length
  if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // Validate hex format
  const sigValidation = validateHex(signature, 96, 'signature');
  if (!sigValidation.valid) throw new Error(sigValidation.error);
  
  const pkValidation = validateHex(public_key, 96, 'public_key');
  if (!pkValidation.valid) throw new Error(pkValidation.error);

  const sigHex = signature.replace(/^0x/, '');
  const pkHex = public_key.replace(/^0x/, '');

  const valid = await verifyHex(message, sigHex, pkHex);

  return {
    valid,
    details: {
      message_length: message.length,
      signature_format: 'valid',
      public_key_format: 'valid'
    }
  };
}

async function verifyAggregateMode(body: any): Promise<{ valid: boolean; details: any }> {
  const { messages, aggregate_signature, public_keys } = body;

  if (!messages || !aggregate_signature || !public_keys) {
    throw new Error('messages, aggregate_signature, and public_keys required');
  }

  if (!Array.isArray(messages) || !Array.isArray(public_keys)) {
    throw new Error('messages and public_keys must be arrays');
  }

  // Validate array lengths
  const msgLimit = validateArrayLength(messages, MAX_SIGNERS, 'messages');
  if (!msgLimit.valid) throw new Error(msgLimit.error);
  
  const pkLimit = validateArrayLength(public_keys, MAX_SIGNERS, 'public_keys');
  if (!pkLimit.valid) throw new Error(pkLimit.error);

  if (messages.length !== public_keys.length) {
    throw new Error('Message count must match public key count');
  }

  if (messages.length === 0) {
    throw new Error('Cannot verify empty aggregate');
  }

  // Validate signature format
  const sigValidation = validateHex(aggregate_signature, 96, 'aggregate_signature');
  if (!sigValidation.valid) throw new Error(sigValidation.error);

  const sigHex = aggregate_signature.replace(/^0x/, '');

  // Validate all public keys
  for (const pk of public_keys) {
    const pkValidation = validateHex(pk, 96, 'public_key');
    if (!pkValidation.valid) throw new Error(pkValidation.error);
  }

  const valid = await verifyAggregateHex(messages, sigHex, public_keys.map((k: string) => k.replace(/^0x/, '')));

  return {
    valid,
    details: {
      signer_count: public_keys.length,
      unique_messages: new Set(messages).size,
      aggregate_signature_format: 'valid'
    }
  };
}

async function verifyMultipleMode(body: any): Promise<{ valid: boolean; details: any }> {
  const { message, aggregate_signature, public_keys } = body;

  if (!message || !aggregate_signature || !public_keys) {
    throw new Error('message, aggregate_signature, and public_keys required');
  }

  if (!Array.isArray(public_keys)) {
    throw new Error('public_keys must be an array');
  }

  // Validate array length
  const pkLimit = validateArrayLength(public_keys, MAX_SIGNERS, 'public_keys');
  if (!pkLimit.valid) throw new Error(pkLimit.error);

  if (public_keys.length === 0) {
    throw new Error('Cannot verify empty multiple');
  }

  // Validate message length
  if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Max ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // Validate signature format
  const sigValidation = validateHex(aggregate_signature, 96, 'aggregate_signature');
  if (!sigValidation.valid) throw new Error(sigValidation.error);

  const sigHex = aggregate_signature.replace(/^0x/, '');
  const pkHexes = public_keys.map((k: string) => k.replace(/^0x/, ''));

  // Validate all public keys
  for (const pk of pkHexes) {
    const pkValidation = validateHex(pk, 96, 'public_key');
    if (!pkValidation.valid) throw new Error(pkValidation.error);
  }

  // Convert hex to bytes for verification
  const { hexToBytes } = await import('@noble/curves/abstract/utils');
  const sigBytes = hexToBytes(sigHex);
  const pkBytes = pkHexes.map(hexToBytes);
  const messageBytes = new TextEncoder().encode(message);

  const bls12_381 = await import('@noble/curves/bls12-381');
  const messages = Array(public_keys.length).fill(messageBytes);
  // verifyBatch is not available in all versions, use individual verify
  let valid = true;
  for (const pk of pkBytes) {
    try {
      const ok = (bls12_381 as any).verifyBatch
        ? (bls12_381 as any).verifyBatch(sigBytes, messages, pkBytes)
        : bls12_381.bls12_381.verify(sigBytes, messageBytes, pk);
      if (!ok) { valid = false; break; }
    } catch { valid = false; break; }
  }

  return {
    valid,
    details: {
      signer_count: public_keys.length,
      message_length: message.length,
      aggregate_signature_format: 'valid'
    }
  };
}

async function verifyByAttestations(body: any): Promise<{ valid: boolean; details: any }> {
  const { attestation_ids, aggregate_signature } = body;

  if (!attestation_ids || !aggregate_signature) {
    throw new Error('attestation_ids and aggregate_signature required');
  }

  if (!Array.isArray(attestation_ids) || attestation_ids.length === 0) {
    throw new Error('attestation_ids must be a non-empty array');
  }

  // Validate array length
  const idLimit = validateArrayLength(attestation_ids, MAX_ATTESTATION_IDS, 'attestation_ids');
  if (!idLimit.valid) throw new Error(idLimit.error);

  // Validate signature format
  const sigValidation = validateHex(aggregate_signature, 96, 'aggregate_signature');
  if (!sigValidation.valid) throw new Error(sigValidation.error);

  // Fetch attestations from database
  const { data: attestations, error } = await getSupabase()
    .from('attestations')
    .select(`
      id,
      claim,
      target_agent_id,
      vouch:target_agent(public_key)
    `)
    .in('id', attestation_ids);

  if (error) {
    throw new Error('Failed to fetch attestations: ' + error.message);
  }

  if (!attestations || attestations.length !== attestation_ids.length) {
    const found = new Set(attestations?.map((a: any) => a.id) || []);
    const missing = attestation_ids.filter((id: string) => !found.has(id));
    throw new Error(`Attestations not found: ${missing.join(', ')}`);
  }

  // Extract public keys (need to join with agents table for BLS keys)
  // For now, we'll need to fetch BLS keys separately
  const agentIds = [...new Set(attestations.map((a: any) => a.target_agent_id))];
  
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

  // Build arrays for verification
  const messages: string[] = [];
  const publicKeys: string[] = [];
  const missingKeys: string[] = [];

  for (const att of attestations) {
    const pk = keyMap.get(att.target_agent_id);
    if (!pk) {
      missingKeys.push(att.target_agent_id);
      continue;
    }
    messages.push(att.claim);
    publicKeys.push(pk);
  }

  if (missingKeys.length > 0) {
    return {
      valid: false,
      details: {
        error: 'Missing BLS keys for agents',
        missing_agents: missingKeys,
        attestation_count: attestations.length,
        verifiable_count: publicKeys.length
      }
    };
  }

  const sigHex = aggregate_signature.replace(/^0x/, '');
  const valid = await verifyAggregateHex(messages, sigHex, publicKeys);

  return {
    valid,
    details: {
      attestation_count: attestations.length,
      signer_count: publicKeys.length,
      unique_claims: new Set(messages).size,
      all_keys_found: true
    }
  };
}

/**
 * GET /api/bls/verify
 * Get verification statistics and benchmark info
 * Rate limited: 30 requests per minute
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const path = '/api/bls/verify';
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    // Run a quick benchmark
    const { benchmark } = await import('@/lib/bls');
    const bench = await benchmark();

    // Get stats from database
    const { data: stats } = await getSupabase()
      .from('aggregated_attestations')
      .select('valid, verified_at', { count: 'exact' });

    const verified = stats?.filter((s: any) => s.valid && s.verified_at).length || 0;
    const pending = stats?.filter((s: any) => !s.verified_at).length || 0;
    const invalid = stats?.filter((s: any) => s.valid === false).length || 0;

    const response = NextResponse.json({
      success: true,
      status: 'BLS12-381 verification active',
      performance: {
        key_generation_ms: Math.round(bench.keygenTime * 100) / 100,
        signing_ms: Math.round(bench.signTime * 100) / 100,
        single_verify_ms: Math.round(bench.verifyTime * 100) / 100,
        aggregation_ms: Math.round(bench.aggregateTime * 100) / 100,
        batch_verify_100_ms: Math.round(bench.batchVerifyTime * 100) / 100,
        batch_size_tested: bench.batchSize,
        target_1000_estimate_ms: Math.round(bench.batchVerifyTime * 10 * 100) / 100
      },
      statistics: {
        total_aggregates: stats?.length || 0,
        verified,
        pending,
        invalid
      }
    });
    
    // Add rate limit headers
    
    return applySecurityHeaders(response);

  } catch (error) {
    const response = NextResponse.json({
      success: false,
      error: 'Failed to get verification stats'
    }, { status: 500 });
    
    return applySecurityHeaders(response);
  }
}
