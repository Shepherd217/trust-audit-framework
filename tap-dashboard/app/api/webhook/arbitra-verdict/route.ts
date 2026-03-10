import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

// Known agent webhooks and their secrets
const AGENT_SECRETS: Record<string, string> = {
  'autopilotai': process.env.AUTOPILOTAI_WEBHOOK_SECRET || 'tap-agcos-hmac-f043ea6cdfd386a9df504a8b83c03f79',
  // Add more agents as needed
};

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-arbitra-signature') || req.headers.get('x-hmac-signature');
    const agentId = req.headers.get('x-agent-id')?.toLowerCase() || 'autopilotai';
    
    const body = await req.text();
    const payload = JSON.parse(body);
    
    // Verify signature
    const secret = AGENT_SECRETS[agentId];
    if (!secret) {
      console.error(`[Arbitra Webhook] Unknown agent: ${agentId}`);
      return NextResponse.json({ error: 'Unknown agent' }, { status: 401 });
    }
    
    if (!signature || !verifySignature(body, signature, secret)) {
      console.error(`[Arbitra Webhook] Invalid signature from ${agentId}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Log the verdict
    console.log('[Arbitra Webhook] Verdict received:', {
      agentId,
      disputeId: payload.disputeId,
      verdict: payload.verdict,
      confidence: payload.confidence,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Store verdict in database, update dispute status
    // TODO: Trigger reputation updates if verdict is final
    // TODO: Notify involved parties
    
    // For now, just acknowledge receipt
    return NextResponse.json({ 
      success: true,
      received: true,
      disputeId: payload.disputeId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Arbitra Webhook] Error:', error);
    return NextResponse.json({ 
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhook/arbitra-verdict',
    method: 'POST',
    requires: ['X-Arbitra-Signature', 'X-Agent-Id'],
    timestamp: new Date().toISOString()
  });
}
