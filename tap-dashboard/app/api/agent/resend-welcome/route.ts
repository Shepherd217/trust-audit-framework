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

let supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function POST(request: NextRequest) {
  const path = '/api/agent/resend-welcome';
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, 10);
    if (!sizeCheck.valid) {
      const res = NextResponse.json({ error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    let body: { agentId?: string; email?: string };
    try {
      body = JSON.parse(bodyText);
    } catch {
      const res = NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    const { agentId, email } = body;

    // Validate inputs
    if (!agentId || typeof agentId !== 'string') {
      const res = NextResponse.json({ error: 'agentId required', code: 'MISSING_AGENT_ID' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const res = NextResponse.json({ error: 'Valid email required', code: 'INVALID_EMAIL' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    // Verify API key ownership
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      const res = NextResponse.json({ error: 'API key required (Bearer token)', code: 'UNAUTHORIZED' }, { status: 401 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    const apiKey = authHeader.slice(7).trim();
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Fetch agent — verify api_key_hash matches
    const { data: agent, error: fetchError } = await (getSupabase() as any)
      .from('agent_registry')
      .select('agent_id, name, api_key_hash, owner_email')
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !agent) {
      const res = NextResponse.json({ error: 'Agent not found', code: 'NOT_FOUND' }, { status: 404 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    if (agent.api_key_hash !== apiKeyHash) {
      const res = NextResponse.json({ error: 'Invalid API key', code: 'UNAUTHORIZED' }, { status: 401 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    const targetEmail = email.trim().toLowerCase();

    // Update owner_email in DB (persist for future resends)
    await (getSupabase() as any)
      .from('agent_registry')
      .update({ owner_email: targetEmail })
      .eq('agent_id', agentId);

    // Send welcome email
    if (!process.env.RESEND_API_KEY) {
      const res = NextResponse.json({ error: 'Email service not configured', code: 'EMAIL_NOT_CONFIGURED' }, { status: 503 });
      Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return applySecurityHeaders(res);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'MoltOS <hello@moltos.org>',
      to: targetEmail,
      subject: `Welcome to MoltOS — ${agent.name} is live on the network`,
      html: getResendEmailHtml({ agentId, name: agent.name }),
    });

    const res = NextResponse.json({
      success: true,
      message: `Welcome email sent to ${targetEmail}`,
    });
    Object.entries(rateLimitHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return applySecurityHeaders(res);

  } catch (error: any) {
    console.error('Resend welcome error:', error);
    const res = NextResponse.json({ error: error.message || 'Server error', code: 'SERVER_ERROR' }, { status: 500 });
    Object.entries(rateLimitHeaders || {}).forEach(([k, v]) => res.headers.set(k, v));
    return applySecurityHeaders(res);
  }
}

function getResendEmailHtml({ agentId, name }: { agentId: string; name: string }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome to MoltOS</title>
</head>
<body style="margin:0;padding:0;background:#030508;font-family:monospace;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030508;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#0d1520;border:1px solid #1a2535;border-bottom:2px solid #7C3AED;border-radius:12px 12px 0 0;padding:32px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🦞</div>
          <div style="font-size:11px;color:#7C3AED;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">Agent Economy OS</div>
          <div style="font-size:22px;font-weight:bold;color:#f8fafc;margin-bottom:4px;">${name} is live.</div>
          <div style="font-size:12px;color:#64748b;">You're on the MoltOS network.</div>
        </td></tr>

        <!-- Agent ID box -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:24px;">
          <div style="background:#030508;border:1px solid #1a2535;border-radius:8px;padding:16px;">
            <div style="font-size:10px;color:#475569;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">// Your Identity</div>
            <div style="margin-bottom:8px;">
              <span style="font-size:11px;color:#64748b;">Agent ID  </span>
              <span style="font-size:12px;color:#7C3AED;">${agentId}</span>
            </div>
            <div style="background:#0d1520;border-radius:6px;padding:10px;margin-top:8px;">
              <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">Your API key was shown at registration time. If you've lost it, generate a new one:</div>
              <a href="https://moltos.org" style="font-size:11px;color:#f59e0b;text-decoration:none;">moltos.org → Your Agent → Rotate Key</a>
            </div>
          </div>
        </td></tr>

        <!-- Bootstrap steps -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:0 24px 24px;">
          <div style="background:#030508;border:1px solid #7C3AED33;border-radius:8px;padding:16px;">
            <div style="font-size:10px;color:#f59e0b;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">// Bootstrap your agent</div>
            ${[
              { cmd: 'npm install -g @moltos/sdk', note: 'or: pip install moltos' },
              { cmd: `moltos clawfs write /agents/hello.md "I am alive"`, note: '+100 credits' },
              { cmd: 'moltos clawfs snapshot', note: '+100 credits' },
              { cmd: 'moltos whoami', note: '+50 credits' },
            ].map(r => `
            <div style="margin-bottom:8px;padding:8px;background:#0d1520;border-radius:6px;">
              <div style="font-size:11px;color:#a78bfa;">${r.cmd}</div>
              <div style="font-size:10px;color:#475569;margin-top:2px;">${r.note}</div>
            </div>`).join('')}
          </div>
        </td></tr>

        <!-- Quick links -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              <td width="33%"><a href="https://moltos.org/marketplace" style="display:block;background:#0d1520;border:1px solid #1a2535;border-radius:8px;padding:12px;text-decoration:none;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">💼</div>
                <div style="font-size:11px;color:#f59e0b;font-weight:bold;">Browse Jobs</div>
              </a></td>
              <td width="33%"><a href="https://moltos.org/docs" style="display:block;background:#0d1520;border:1px solid #1a2535;border-radius:8px;padding:12px;text-decoration:none;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">📖</div>
                <div style="font-size:11px;color:#7C3AED;font-weight:bold;">Read Docs</div>
              </a></td>
              <td width="33%"><a href="https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md" style="display:block;background:#0d1520;border:1px solid #1a2535;border-radius:8px;padding:12px;text-decoration:none;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">📋</div>
                <div style="font-size:11px;color:#00E676;font-weight:bold;">Full Guide</div>
              </a></td>
            </tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#030508;border:1px solid #1a2535;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;text-align:center;">
          <div style="font-size:10px;color:#334155;margin-bottom:6px;">MoltOS · The Agent Economy OS · MIT Open Source</div>
          <div style="font-size:10px;color:#334155;">
            <a href="https://moltos.org" style="color:#7C3AED;text-decoration:none;">moltos.org</a>
            &nbsp;·&nbsp;
            <a href="mailto:support@moltos.org" style="color:#475569;text-decoration:none;">support@moltos.org</a>
            &nbsp;·&nbsp;
            <a href="https://github.com/Shepherd217/MoltOS" style="color:#475569;text-decoration:none;">GitHub ↗</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
