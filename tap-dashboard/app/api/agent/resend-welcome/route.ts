export const dynamic = 'force-dynamic';
/**
 * Resend Welcome Email API
 * POST /api/agent/resend-welcome
 * 
 * Resends the welcome email for an existing agent.
 * Requires the agent's API key for auth (proves ownership).
 * Also allows updating/setting owner_email for the first time.
 * 
 * Body: { agentId: string, email: string }
 * Header: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';
import { Resend } from 'resend';
import { getWelcomeEmailHtml } from '@/lib/email-template';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

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

export async function POST(request: NextRequest) {
  const path = '/api/agent/resend-welcome';
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;;

  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, 10);
    if (!sizeCheck.valid) {
      const res = NextResponse.json({ error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
      return applySecurityHeaders(res);
    }

    let body: { agentId?: string; email?: string };
    try {
      body = JSON.parse(bodyText);
    } catch {
      const res = NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 });
      return applySecurityHeaders(res);
    }

    const { agentId, email } = body;

    // Validate inputs
    if (!agentId || typeof agentId !== 'string') {
      const res = NextResponse.json({ error: 'agentId required', code: 'MISSING_AGENT_ID' }, { status: 400 });
      return applySecurityHeaders(res);
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const res = NextResponse.json({ error: 'Valid email required', code: 'INVALID_EMAIL' }, { status: 400 });
      return applySecurityHeaders(res);
    }

    // Verify API key ownership
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const res = NextResponse.json({ error: 'API key required (Bearer token)', code: 'UNAUTHORIZED' }, { status: 401 });
      return applySecurityHeaders(res);
    }

    const apiKey = authHeader.slice(7).trim();
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Fetch agent — verify api_key_hash matches
    const { data: agent, error: fetchError } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name, api_key_hash, owner_email')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (fetchError || !agent) {
      const res = NextResponse.json({ error: 'Agent not found', code: 'NOT_FOUND' }, { status: 404 });
      return applySecurityHeaders(res);
    }

    if (agent.api_key_hash !== apiKeyHash) {
      const res = NextResponse.json({ error: 'Invalid API key', code: 'UNAUTHORIZED' }, { status: 401 });
      return applySecurityHeaders(res);
    }

    const targetEmail = email.trim().toLowerCase();

    // Update owner_email in DB (persist for future resends)
    await getSupabase()
      .from('agent_registry')
      .update({ owner_email: targetEmail })
      .eq('agent_id', agentId);

    // Send welcome email
    if (!process.env.RESEND_API_KEY) {
      const res = NextResponse.json({ error: 'Email service not configured', code: 'EMAIL_NOT_CONFIGURED' }, { status: 503 });
      return applySecurityHeaders(res);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'MoltOS <hello@moltos.org>',
      to: targetEmail,
      subject: `Welcome to MoltOS — ${agent.name} is live on the network`,
      html: getWelcomeEmailHtml({ agentId, name: agent.name }),
    });

    const res = NextResponse.json({
      success: true,
      message: `Welcome email sent to ${targetEmail}`,
    });
    return applySecurityHeaders(res);

  } catch (error: any) {
    console.error('Resend welcome error:', error);
    const res = NextResponse.json({ error: error.message || 'Server error', code: 'SERVER_ERROR' }, { status: 500 });
    return applySecurityHeaders(res);
  }
}

