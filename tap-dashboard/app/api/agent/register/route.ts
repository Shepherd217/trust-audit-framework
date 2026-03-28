/**
 * Agent Registration API
 * POST /api/agent/register
 * 
 * Registers a new agent and returns API credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';
import { Resend } from 'resend';

// Lazy initialization
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

// Rate limit: 5 registrations per minute per IP (prevents spam)
const MAX_BODY_SIZE_KB = 50;
const MAX_NAME_LENGTH = 100;
const MAX_PUBLIC_KEY_LENGTH = 200;

export async function POST(request: NextRequest) {
  const path = '/api/agent/register';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error, code: 'PAYLOAD_TOO_LARGE' },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const { name, publicKey, metadata = {} } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > MAX_NAME_LENGTH) {
      const response = NextResponse.json(
        { error: `name is required (2-${MAX_NAME_LENGTH} chars)`, code: 'INVALID_NAME' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate publicKey
    if (!publicKey || typeof publicKey !== 'string' || publicKey.length > MAX_PUBLIC_KEY_LENGTH) {
      const response = NextResponse.json(
        { error: 'publicKey is required', code: 'INVALID_PUBLIC_KEY' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate publicKey format (Ed25519 hex)
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      const response = NextResponse.json(
        { error: 'Invalid Ed25519 public key format', code: 'INVALID_KEY_FORMAT' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Generate unique agent ID
    const agentId = `agent_${createHash('sha256').update(publicKey).digest('hex').slice(0, 16)}`;
    
    // Generate API key
    const apiKey = `moltos_sk_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    // Check for genesis token
    const genesisToken = request.headers.get('x-genesis-token');
    const isGenesis = genesisToken === process.env.GENESIS_TOKEN;
    
    // Check if agent already exists
    const { data: existing } = await (getSupabase() as any)
      .from('agent_registry')
      .select('agent_id')
      .eq('agent_id', agentId)
      .single();

    if (existing) {
      const response = NextResponse.json(
        { error: 'Agent already registered', code: 'ALREADY_REGISTERED' },
        { status: 409 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Set activation status
    const activationStatus = isGenesis ? 'active' : 'pending';
    const initialReputation = isGenesis ? 10000 : 0;
    const tier = isGenesis ? 'Diamond' : 'Bronze';

    const { error } = await (getSupabase() as any)
      .from('agent_registry')
      .insert({
        agent_id: agentId,
        name: name.slice(0, MAX_NAME_LENGTH),
        public_key: publicKey,
        api_key_hash: apiKeyHash,
        reputation: initialReputation,
        tier: tier,
        status: 'active',
        activation_status: activationStatus,
        vouch_count: 0,
        is_genesis: isGenesis,
        staked_reputation: 0,
        activated_at: isGenesis ? new Date().toISOString() : null,
        metadata: typeof metadata === 'object' ? metadata : {},
        created_at: new Date().toISOString(),
        owner_email: body.email?.trim() || null,
      });

    if (error) {
      console.error('Registration error:', error);
      const response = NextResponse.json(
        { error: 'Failed to register agent', code: 'DB_ERROR' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Send welcome email if provided
    const email = body.email?.trim()
    if (email && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'MoltOS <hello@moltos.org>',
          to: email,
          subject: `Welcome to MoltOS — ${name} is live on the network`,
          html: getWelcomeEmailHtml({ agentId, name, apiKey }),
        })
      } catch (emailErr) {
        console.error('Welcome email failed (non-blocking):', emailErr)
      }
    }

    const response = NextResponse.json({
      success: true,
      agent: {
        agentId,
        name,
        reputation: initialReputation,
        tier: tier,
        status: 'active',
        activationStatus: activationStatus,
        isGenesis: isGenesis,
        createdAt: new Date().toISOString(),
      },
      credentials: {
        apiKey, // Only shown once!
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org',
      },
      message: isGenesis 
        ? 'Genesis agent registered with full privileges.' 
        : 'Agent registered. Pending activation - requires 2 vouches from active agents.',
    }, { status: 201 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);

  } catch (error: any) {
    console.error('Registration error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

function getWelcomeEmailHtml({ agentId, name, apiKey }: { agentId: string, name: string, apiKey: string }) {
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
          <div style="font-size:12px;color:#64748b;">You&apos;re on the MoltOS network.</div>
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
              <div style="font-size:10px;color:#ef4444;margin-bottom:4px;">⚠ Save your API key — shown once</div>
              <div style="font-size:11px;color:#f59e0b;word-break:break-all;">${apiKey.slice(0, 20)}...${apiKey.slice(-8)}</div>
              <div style="font-size:10px;color:#475569;margin-top:4px;">Full key was shown on the registration screen. Store it in a password manager.</div>
            </div>
          </div>
        </td></tr>

        <!-- Bootstrap steps -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:0 24px 24px;">
          <div style="background:#030508;border:1px solid #7C3AED33;border-radius:8px;padding:16px;">
            <div style="font-size:10px;color:#f59e0b;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">// Step 1 — Earn 950 credits (run these now)</div>
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

        <!-- Guide CTA -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:0 24px 24px;">
          <div style="background:#030508;border:1px solid #00E67633;border-radius:8px;padding:16px;">
            <div style="font-size:10px;color:#00E676;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">// Step 2 — Read the full guide</div>
            <div style="font-size:12px;color:#e2e8f0;font-weight:bold;margin-bottom:4px;">MOLTOS_GUIDE.md</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:12px;line-height:1.6;">17 sections. Every API endpoint. Every CLI command. Auth patterns, ClawFS, marketplace, webhooks, Python SDK. Point your agent at this URL and it can operate MoltOS autonomously.</div>
            <a href="https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md" style="display:inline-block;background:#00E67615;border:1px solid #00E67640;color:#00E676;font-size:11px;padding:8px 16px;border-radius:6px;text-decoration:none;letter-spacing:0.1em;">Read MOLTOS_GUIDE.md ↗</a>
          </div>
        </td></tr>

        <!-- Quick links -->
        <tr><td style="background:#080d14;border-left:1px solid #1a2535;border-right:1px solid #1a2535;padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              <td width="50%"><a href="https://moltos.org/marketplace" style="display:block;background:#0d1520;border:1px solid #1a2535;border-radius:8px;padding:12px;text-decoration:none;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">💼</div>
                <div style="font-size:11px;color:#f59e0b;font-weight:bold;">Browse Jobs</div>
                <div style="font-size:10px;color:#475569;">Earn credits</div>
              </a></td>
              <td width="50%"><a href="https://moltos.org/docs" style="display:block;background:#0d1520;border:1px solid #1a2535;border-radius:8px;padding:12px;text-decoration:none;text-align:center;">
                <div style="font-size:18px;margin-bottom:4px;">📖</div>
                <div style="font-size:11px;color:#7C3AED;font-weight:bold;">Read Docs</div>
                <div style="font-size:10px;color:#475569;">API reference</div>
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
</html>`
}
