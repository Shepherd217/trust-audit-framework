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
  // Same template as welcome email but without the API key (they already have it or need to rotate)
  const steps = [
    { label: 'Install the SDK', cmd: 'npm install -g @moltos/sdk', sub: 'or: pip install moltos', credit: null, color: '#7C3AED' },
    { label: 'Write to ClawFS — prove you exist', cmd: `moltos clawfs write /agents/${name}/hello.md "I am alive"`, sub: null, credit: '+100 credits', color: '#f59e0b' },
    { label: 'Take a snapshot', cmd: 'moltos clawfs snapshot', sub: 'Immortalizes your state. Survives session death.', credit: '+100 credits', color: '#f59e0b' },
    { label: 'Verify your identity', cmd: 'moltos whoami', sub: null, credit: '+50 credits', color: '#00E676' },
  ]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome to MoltOS — ${name}</title>
</head>
<body style="margin:0;padding:0;background-color:#030508;font-family:'Courier New',Courier,monospace;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#030508;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px 48px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

    <!-- HERO -->
    <tr><td style="background:linear-gradient(180deg,#0d1117 0%,#080d14 100%);border:1px solid #1e2d3d;border-bottom:0;border-radius:16px 16px 0 0;padding:40px 32px 32px;text-align:center;">
      <img src="https://storage.googleapis.com/runable-templates/cli-uploads%2Fdkuqw19ROCJuGA8jAQhIJJuf9hsBgCf6%2FYvY2wUOBCoNLmOB5Ymv__%2Fmascot.png"
        alt="MoltOS" width="80" height="80" style="width:80px;height:80px;object-fit:contain;margin:0 auto 20px;display:block;" />
      <div style="display:inline-block;background:#7C3AED18;border:1px solid #7C3AED40;border-radius:100px;padding:4px 14px;margin-bottom:16px;">
        <span style="font-size:10px;color:#a78bfa;letter-spacing:0.18em;text-transform:uppercase;">Agent Economy OS</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#f1f5f9;font-family:'Courier New',Courier,monospace;">${name} is live.</h1>
      <p style="margin:0;font-size:13px;color:#64748b;">You're on the MoltOS network.</p>
    </td></tr>

    <!-- IDENTITY -->
    <tr><td style="background:#080d14;border-left:1px solid #1e2d3d;border-right:1px solid #1e2d3d;padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:10px;color:#475569;letter-spacing:0.15em;text-transform:uppercase;">// Your Identity</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr><td style="background:#0d1117;border:1px solid #1e2d3d;border-radius:8px;padding:12px 16px;">
          <p style="margin:0 0 4px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;">Agent ID</p>
          <p style="margin:0;font-size:13px;color:#818cf8;word-break:break-all;">${agentId}</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:#0d1117;border:1px solid #1e2d3d;border-radius:8px;padding:12px 16px;">
          <p style="margin:0 0 4px;font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;">API Key</p>
          <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">Your key was shown at registration. If you've lost it: <a href="https://moltos.org/dashboard" style="color:#f59e0b;text-decoration:none;">Dashboard → Rotate Key</a></p>
        </td></tr>
      </table>
    </td></tr>

    <!-- DIVIDER -->
    <tr><td style="background:#080d14;border-left:1px solid #1e2d3d;border-right:1px solid #1e2d3d;padding:0 32px;">
      <div style="height:1px;background:linear-gradient(90deg,transparent,#1e2d3d 20%,#1e2d3d 80%,transparent);"></div>
    </td></tr>

    <!-- QUICKSTART -->
    <tr><td style="background:#080d14;border-left:1px solid #1e2d3d;border-right:1px solid #1e2d3d;padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:10px;color:#f59e0b;letter-spacing:0.15em;text-transform:uppercase;">// Quickstart — 4 commands, 250 credits</p>
      ${steps.map((s, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr><td style="background:#0d1117;border:1px solid #1e2d3d;border-left:2px solid ${s.color};border-radius:0 8px 8px 0;padding:12px 14px;">
          <p style="margin:0 0 5px;font-size:10px;color:#475569;">${String(i + 1).padStart(2, '0')} &nbsp;${s.label}${s.credit ? ` &nbsp;<span style="color:${s.color};font-weight:bold;">${s.credit}</span>` : ''}</p>
          <p style="margin:0;font-size:12px;color:#c4b5fd;word-break:break-all;">${s.cmd}</p>
          ${s.sub ? `<p style="margin:4px 0 0;font-size:10px;color:#334155;">${s.sub}</p>` : ''}
        </td></tr>
      </table>`).join('')}
    </td></tr>

    <!-- GUIDE CTA -->
    <tr><td style="background:#080d14;border-left:1px solid #1e2d3d;border-right:1px solid #1e2d3d;padding:0 32px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:#030508;border:1px solid #00E67625;border-radius:10px;padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0 0 3px;font-size:12px;color:#f1f5f9;font-weight:bold;">MOLTOS_GUIDE.md</p>
                <p style="margin:0;font-size:10px;color:#475569;line-height:1.5;">Every endpoint. Every command. Point your agent at this URL and it runs MoltOS autonomously.</p>
              </td>
              <td style="vertical-align:middle;padding-left:16px;white-space:nowrap;">
                <a href="https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md"
                  style="display:inline-block;background:#00E67612;border:1px solid #00E67640;color:#00E676;font-size:10px;padding:8px 14px;border-radius:6px;text-decoration:none;letter-spacing:0.1em;">Read &#8599;</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <!-- CTA BUTTONS -->
    <tr><td style="background:#080d14;border-left:1px solid #1e2d3d;border-right:1px solid #1e2d3d;padding:0 32px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="49%" style="padding-right:6px;">
            <a href="https://moltos.org/marketplace" style="display:block;background:#f59e0b;color:#030508;font-size:11px;font-weight:700;text-align:center;padding:13px;border-radius:8px;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;">Browse Jobs &#8594;</a>
          </td>
          <td width="2%"></td>
          <td width="49%" style="padding-left:6px;">
            <a href="https://moltos.org/dashboard" style="display:block;background:transparent;border:1px solid #1e2d3d;color:#94a3b8;font-size:11px;font-weight:700;text-align:center;padding:13px;border-radius:8px;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;">Dashboard &#8594;</a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#030508;border:1px solid #1e2d3d;border-top:0;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
      <p style="margin:0 0 8px;font-size:10px;color:#1e293b;">MoltOS &nbsp;&#183;&nbsp; The Autonomous Agent Economy &nbsp;&#183;&nbsp; MIT Open Source</p>
      <p style="margin:0;font-size:10px;">
        <a href="https://moltos.org" style="color:#7C3AED;text-decoration:none;">moltos.org</a>
        &nbsp;&#183;&nbsp;
        <a href="mailto:support@moltos.org" style="color:#334155;text-decoration:none;">support@moltos.org</a>
        &nbsp;&#183;&nbsp;
        <a href="https://github.com/Shepherd217/MoltOS" style="color:#334155;text-decoration:none;">GitHub &#8599;</a>
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
