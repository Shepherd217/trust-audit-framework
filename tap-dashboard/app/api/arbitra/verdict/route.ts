/**
 * Arbitra External Verdict Webhook
 * Receives verdicts from external ARBITER instances
 * 
 * POST /api/arbitra/verdict
 * GET  /api/arbitra/verdict (health check)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { createHmac, timingSafeEqual } from 'crypto';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

// ARBITER webhook secret
const ARBITER_WEBHOOK_SECRET = process.env.ARBITER_WEBHOOK_SECRET;

// Replay protection window (5 minutes)
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

interface ArbiterVerdict {
  verdict_id: string;
  dispute_id: string;
  resolution: 'REFUND' | 'REDO' | 'COMPENSATION' | 'DISMISSED';
  decision: string;
  confidence: number;
  committee_votes: {
    in_favor: number;
    against: number;
    abstain: number;
  };
  evidence_reviewed: string[];
  timestamp: string;
  arbiter_version: string;
}

// ============================================================================
// POST Handler - Receive Verdict
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (critical endpoint - affects reputation)
    const rateLimitResult = await applyRateLimit(request, 'critical');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Verify webhook secret is configured
    if (!ARBITER_WEBHOOK_SECRET) {
      console.error('[ARBITRA] ARBITER_WEBHOOK_SECRET not configured');
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Webhook not configured', code: 'CONFIG_ERROR' },
          { status: 500 }
        )
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify HMAC signature
    const signature = request.headers.get('x-arbiter-signature');
    if (!signature) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Missing signature header', code: 'MISSING_SIGNATURE' },
          { status: 401 }
        )
      );
    }

    if (!verifySignature(rawBody, signature, ARBITER_WEBHOOK_SECRET)) {
      console.warn('[ARBITRA] Invalid signature received');
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        )
      );
    }

    // Parse payload
    let verdict: ArbiterVerdict;
    try {
      verdict = JSON.parse(rawBody);
    } catch (e) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
          { status: 400 }
        )
      );
    }

    // Validate payload structure
    const validation = validateVerdict(verdict);
    if (!validation.valid) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: validation.error, code: 'INVALID_PAYLOAD' },
          { status: 400 }
        )
      );
    }

    // Replay protection
    const timestamp = request.headers.get('x-arbiter-timestamp');
    if (timestamp && !verifyTimestamp(timestamp)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Request expired or replay detected', code: 'REPLAY_DETECTED' },
          { status: 401 }
        )
      );
    }

    const db = getSupabase();

    // Check for duplicate verdict FIRST (before dispute lookup)
    const { data: existingVerdict } = await db
      .from('arbitra_external_verdicts')
      .select('verdict_id')
      .eq('verdict_id', verdict.verdict_id)
      .single();

    if (existingVerdict) {
      return applySecurityHeaders(
        NextResponse.json(
          { 
            success: true, 
            message: 'Verdict already processed',
            verdict_id: verdict.verdict_id 
          },
          { status: 200 }
        )
      );
    }

    // Also check orphaned verdicts for duplicates
    const { data: existingOrphaned } = await db
      .from('arbitra_orphaned_verdicts')
      .select('verdict_id')
      .eq('verdict_id', verdict.verdict_id)
      .single();

    if (existingOrphaned) {
      return applySecurityHeaders(
        NextResponse.json(
          { 
            success: true, 
            message: 'Verdict already processed (orphaned)',
            verdict_id: verdict.verdict_id 
          },
          { status: 200 }
        )
      );
    }

    // Find the dispute
    const { data: dispute, error: disputeError } = await db
      .from('dispute_cases')
      .select('*')
      .eq('id', verdict.dispute_id)
      .single();

    if (disputeError || !dispute) {
      // Store orphaned verdict for later processing
      await storeOrphanedVerdict(db, verdict, 'DISPUTE_NOT_FOUND');
      return applySecurityHeaders(
        NextResponse.json(
          { 
            error: 'Dispute not found', 
            code: 'DISPUTE_NOT_FOUND',
            verdict_stored: true
          },
          { status: 202 }
        )
      );
    }

    // Check if dispute already resolved
    if (dispute.status === 'accepted' || dispute.status === 'rejected') {
      await storeExternalVerdict(db, verdict, dispute.id, 'DISPUTE_ALREADY_RESOLVED');
      return applySecurityHeaders(
        NextResponse.json(
          { 
            success: true, 
            message: 'Dispute already resolved, verdict logged',
            dispute_status: dispute.status
          },
          { status: 200 }
        )
      );
    }

    // Map ARBITER resolution to internal format
    const internalResolution = mapResolution(verdict.resolution);
    const result = determineResult(verdict.resolution);

    // Update dispute with external verdict
    const { error: updateError } = await db
      .from('dispute_cases')
      .update({
        status: result === 'CLAIMANT_WINS' ? 'accepted' : 'rejected',
        resolution: result === 'CLAIMANT_WINS' ? 'guilty' : 'innocent',
        resolution_reason: `[ARBITER ${verdict.arbiter_version}] ${verdict.decision}`,
        resolved_at: new Date().toISOString(),
        external_verdict: {
          verdict_id: verdict.verdict_id,
          arbiter_version: verdict.arbiter_version,
          confidence: verdict.confidence,
          committee_votes: verdict.committee_votes,
          decision: verdict.decision,
          evidence_reviewed: verdict.evidence_reviewed,
          received_at: new Date().toISOString()
        }
      })
      .eq('id', verdict.dispute_id);

    if (updateError) {
      console.error('[ARBITRA] Failed to update dispute:', updateError);
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'Failed to apply verdict', code: 'UPDATE_FAILED' },
          { status: 500 }
        )
      );
    }

    // Store external verdict record
    await storeExternalVerdict(db, verdict, dispute.id, 'APPLIED');

    // Apply reputation changes
    await applyExternalReputationChanges(db, dispute, verdict);

    console.log(`[ARBITRA] External verdict applied: ${verdict.verdict_id} → dispute ${verdict.dispute_id}`);

    return applySecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Verdict received and applied',
        verdict_id: verdict.verdict_id,
        dispute_id: verdict.dispute_id,
        result: result,
        resolution: internalResolution
      })
    );

  } catch (error) {
    console.error('[ARBITRA] Verdict processing error:', error);
    return applySecurityHeaders(
      NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    );
  }
}

// ============================================================================
// GET Handler - Health Check
// ============================================================================

export async function GET(request: NextRequest) {
  return applySecurityHeaders(
    NextResponse.json({
      status: 'ok',
      endpoint: '/api/arbitra/verdict',
      method: 'POST',
      description: 'ARBITER external verdict ingestion endpoint',
      auth: 'HMAC-SHA256 via X-Arbiter-Signature header',
      timestamp: new Date().toISOString()
    })
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const normalizedSig = signature.toLowerCase().replace(/^0x/, '');
    const normalizedExpected = expected.toLowerCase().replace(/^0x/, '');
    
    const sigBuf = Buffer.from(normalizedSig, 'hex');
    const expectedBuf = Buffer.from(normalizedExpected, 'hex');
    
    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }
    
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch (e) {
    console.error('[ARBITRA] Signature verification error:', e);
    return false;
  }
}

function verifyTimestamp(timestamp: string): boolean {
  try {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    
    const now = Date.now();
    const diff = Math.abs(now - ts * 1000);
    
    return diff <= REPLAY_WINDOW_MS;
  } catch (e) {
    return false;
  }
}

function validateVerdict(verdict: any): { valid: boolean; error?: string } {
  if (!verdict) {
    return { valid: false, error: 'Empty payload' };
  }

  const required = ['verdict_id', 'dispute_id', 'resolution', 'decision', 'timestamp'];
  for (const field of required) {
    if (!(field in verdict)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  const validResolutions = ['REFUND', 'REDO', 'COMPENSATION', 'DISMISSED'];
  if (!validResolutions.includes(verdict.resolution)) {
    return { valid: false, error: `Invalid resolution: ${verdict.resolution}` };
  }

  if ('confidence' in verdict) {
    const conf = verdict.confidence;
    if (typeof conf !== 'number' || conf < 0 || conf > 1) {
      return { valid: false, error: 'Confidence must be a number between 0 and 1' };
    }
  }

  return { valid: true };
}

function mapResolution(arbiterResolution: string): string {
  const mapping: Record<string, string> = {
    'REFUND': 'REFUND_100_PERCENT',
    'REDO': 'TASK_REDO_REQUIRED',
    'COMPENSATION': 'PARTIAL_COMPENSATION',
    'DISMISSED': 'NO_ACTION'
  };
  
  return mapping[arbiterResolution] || arbiterResolution;
}

function determineResult(resolution: string): string {
  switch (resolution) {
    case 'DISMISSED':
      return 'RESPONDENT_WINS';
    case 'REFUND':
    case 'REDO':
    case 'COMPENSATION':
    default:
      return 'CLAIMANT_WINS';
  }
}

async function storeExternalVerdict(db: any, verdict: ArbiterVerdict, disputeId: string, status: string): Promise<void> {
  const { error } = await db
    .from('arbitra_external_verdicts')
    .insert({
      verdict_id: verdict.verdict_id,
      dispute_id: disputeId,
      arbiter_version: verdict.arbiter_version,
      resolution: verdict.resolution,
      confidence: verdict.confidence,
      committee_votes: verdict.committee_votes,
      decision: verdict.decision,
      evidence_reviewed: verdict.evidence_reviewed,
      received_at: new Date().toISOString(),
      status: status
    });

  if (error) {
    console.error('[ARBITRA] Failed to store external verdict:', error);
  }
}

async function storeOrphanedVerdict(db: any, verdict: ArbiterVerdict, reason: string): Promise<void> {
  const { error } = await db
    .from('arbitra_orphaned_verdicts')
    .insert({
      verdict_id: verdict.verdict_id,
      dispute_id: verdict.dispute_id,
      arbiter_version: verdict.arbiter_version,
      resolution: verdict.resolution,
      confidence: verdict.confidence,
      committee_votes: verdict.committee_votes,
      decision: verdict.decision,
      evidence_reviewed: verdict.evidence_reviewed,
      received_at: new Date().toISOString(),
      orphan_reason: reason
    });

  if (error) {
    console.error('[ARBITRA] Failed to store orphaned verdict:', error);
  }
}

async function applyExternalReputationChanges(db: any, dispute: any, verdict: ArbiterVerdict): Promise<void> {
  let winner: string;
  let loser: string;
  
  switch (verdict.resolution) {
    case 'DISMISSED':
      winner = dispute.resolved_by || dispute.reporter_id;
      loser = dispute.reporter_id;
      break;
    case 'REFUND':
    case 'REDO':
    case 'COMPENSATION':
    default:
      winner = dispute.reporter_id;
      loser = dispute.target_id;
      break;
  }

  const baseDelta = dispute.bond_amount || 50;
  const confidenceMultiplier = verdict.confidence || 0.5;
  const winnerDelta = Math.round(baseDelta * confidenceMultiplier);
  const loserDelta = Math.round(baseDelta * confidenceMultiplier * 2);

  try {
    // Update winner reputation
    await db.rpc('boost_reputation' as any, {
      agent: winner,
      amount: winnerDelta
    } as any);

    // Update loser reputation
    await db.rpc('slash_agent' as any, {
      p_target_id: loser,
      p_slash_amount: loserDelta,
      p_reason: `ARBITER verdict: ${verdict.resolution}`,
      p_resolved_by: 'arbitra_external'
    });

    console.log(`[ARBITRA] Reputation updated: ${winner} +${winnerDelta}, ${loser} -${loserDelta}`);
  } catch (error) {
    console.error('[ARBITRA] Failed to apply reputation changes:', error);
  }
}
