export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

/**
 * Arbitra Verdict Webhook
 * Receives dispute verdicts from external agents (AutoPilotAI, etc.)
 * Endpoint: /api/webhook/arbitra-verdict
 * 
 * Expected payload:
 * {
 *   disputeId: string,
 *   verdict: 'guilty' | 'innocent' | 'inconclusive',
 *   evidence: string[],
 *   confidence: number,
 *   timestamp: string,
 *   agentId: string
 * }
 * 
 * HMAC-SHA256 signature required in header: X-Arbitra-Signature
 */

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

// Known agent webhooks and their secrets
const AGENT_SECRETS: Record<string, string> = {
  'autopilotai': process.env.AUTOPILOTAI_WEBHOOK_SECRET ?? '',
  // Add more agents as needed
};

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Store verdict and update dispute status
 */
async function storeVerdict(
  disputeId: string,
  verdict: 'guilty' | 'innocent' | 'inconclusive',
  evidence: string[],
  confidence: number,
  agentId: string
): Promise<void> {
  const db = getSupabase();
  
  // Map webhook verdict to dispute resolution
  const resolution = verdict === 'inconclusive' ? null : verdict;
  const status = verdict === 'guilty' ? 'accepted' : 
                 verdict === 'innocent' ? 'rejected' : 'under_review';
  
  // Update dispute case
  const { error } = await db
    .from('dispute_cases')
    .update({
      resolution,
      resolution_reason: `External verdict from ${agentId} (confidence: ${confidence}%)`,
      resolved_at: new Date().toISOString(),
      resolved_by: agentId,
      status,
      evidence_cid: evidence.length > 0 ? evidence[0] : null
    })
    .eq('id', disputeId);
  
  if (error) {
    throw new Error(`Failed to update dispute: ${error.message}`);
  }
}

/**
 * Trigger reputation updates for guilty verdicts
 */
async function updateReputations(
  disputeId: string,
  verdict: 'guilty' | 'innocent' | 'inconclusive'
): Promise<void> {
  if (verdict !== 'guilty') return;
  
  const db = getSupabase();
  
  // Get dispute details
  const { data: dispute, error } = await db
    .from('dispute_cases')
    .select('target_id, slash_amount, bond_amount, reporter_id')
    .eq('id', disputeId)
    .maybeSingle();
  
  if (error || !dispute) {
    console.error('Failed to fetch dispute for reputation update:', error);
    return;
  }
  
  // Apply slash to target agent
  const slashAmount = dispute.slash_amount || Math.min(50, dispute.bond_amount);
  
  const { error: slashError } = await db.rpc('slash_agent_reputation' as any, {
    p_agent_id: dispute.target_id,
    p_amount: slashAmount,
    p_reason: `Dispute resolution: ${disputeId}`
  });
  
  if (slashError) {
    console.error('Failed to slash agent reputation:', slashError);
  } else {
    console.error(`Applied ${slashAmount} reputation slash to ${dispute.target_id}`);
  }
  
  // Reward reporter
  const { error: rewardError } = await db.rpc('add_reputation' as any, {
    p_agent_id: dispute.reporter_id,
    p_amount: Math.floor(slashAmount / 2),
    p_reason: `Successful dispute report: ${disputeId}`
  });
  
  if (rewardError) {
    console.error('Failed to reward reporter:', rewardError);
  }
}

/**
 * Notify involved parties of verdict
 */
async function notifyParties(
  disputeId: string,
  verdict: 'guilty' | 'innocent' | 'inconclusive',
  agentId: string
): Promise<void> {
  const db = getSupabase();
  
  // Get dispute details
  const { data: dispute, error } = await db
    .from('dispute_cases')
    .select('target_id, reporter_id')
    .eq('id', disputeId)
    .maybeSingle();
  
  if (error || !dispute) return;
  
  const notifications = [];
  
  // Notify target
  notifications.push({
    agent_id: dispute.target_id,
    type: 'dispute_resolved',
    title: `Dispute ${verdict === 'guilty' ? 'Upheld' : 'Dismissed'}`,
    message: `A dispute against you has been resolved: ${verdict}. Dispute ID: ${disputeId.slice(0, 8)}`,
    metadata: { dispute_id: disputeId, verdict }
  });
  
  // Notify reporter
  notifications.push({
    agent_id: dispute.reporter_id,
    type: 'dispute_resolved',
    title: `Your Dispute ${verdict === 'guilty' ? 'Succeeded' : 'Concluded'}`,
    message: `Your reported dispute has been resolved: ${verdict}. Dispute ID: ${disputeId.slice(0, 8)}`,
    metadata: { dispute_id: disputeId, verdict }
  });
  
  // Insert notifications
  const { error: notifyError } = await db
    .from('notifications')
    .insert(notifications);
  
  if (notifyError) {
    console.error('Failed to create notifications:', notifyError);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(req, 'critical');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const signature = req.headers.get('x-arbitra-signature') || req.headers.get('x-hmac-signature');
    const agentId = req.headers.get('x-agent-id')?.toLowerCase() || 'autopilotai';
    
    const body = await req.text();
    const payload = JSON.parse(body);
    
    // Verify signature
    const secret = AGENT_SECRETS[agentId];
    if (!secret) {
      console.error(`[Arbitra Webhook] Unknown agent: ${agentId}`);
      return applySecurityHeaders(NextResponse.json({ error: 'Unknown agent' }, { status: 401 }));
    }
    
    if (!signature || !verifySignature(body, signature, secret)) {
      console.error(`[Arbitra Webhook] Invalid signature from ${agentId}`);
      return applySecurityHeaders(NextResponse.json({ error: 'Invalid signature' }, { status: 401 }));
    }
    
    const { disputeId, verdict, evidence, confidence } = payload;
    
    // Validate required fields
    if (!disputeId || !verdict) {
      return applySecurityHeaders(NextResponse.json({ 
        error: 'disputeId and verdict are required' 
      }, { status: 400 }));
    }
    
    // Log the verdict
    console.error('[Arbitra Webhook] Verdict received:', {
      agentId,
      disputeId,
      verdict,
      confidence,
      timestamp: new Date().toISOString()
    });
    
    // 1. Store verdict in database
    await storeVerdict(disputeId, verdict, evidence || [], confidence || 0, agentId);
    
    // 2. Trigger reputation updates if verdict is final
    await updateReputations(disputeId, verdict);
    
    // 3. Notify involved parties
    await notifyParties(disputeId, verdict, agentId);
    
    return applySecurityHeaders(NextResponse.json({ 
      success: true,
      received: true,
      disputeId,
      verdict,
      processed: true,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('[Arbitra Webhook] Error:', error);
    return applySecurityHeaders(NextResponse.json({ 
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }));
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  return applySecurityHeaders(NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhook/arbitra-verdict',
    method: 'POST',
    requires: ['X-Arbitra-Signature', 'X-Agent-Id'],
    timestamp: new Date().toISOString()
  }));
}
