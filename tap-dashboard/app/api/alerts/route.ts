/**
 * MoltOS Alerting System
 * 
 * Sends notifications when health checks fail or anomalies are detected.
 * Supports Discord webhooks and PagerDuty integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Alert configuration
const ALERT_CONFIG = {
  // Cooldown between alerts (prevent spam)
  cooldownMs: 5 * 60 * 1000, // 5 minutes
  
  // Severity levels
  severity: {
    critical: ['database', 'stripe'],
    warning: ['bls_verification', 'notifications']
  }
};

// Lazy Supabase client
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

interface AlertPayload {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  title: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Send Discord webhook alert
 */
async function sendDiscordAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
  if (!webhookUrl) {
    console.log('[Alert] Discord webhook not configured, skipping');
    return false;
  }
  
  // Color based on severity
  const colors = {
    critical: 0xFF0000,  // Red
    warning: 0xFFA500,   // Orange
    info: 0x00FF00       // Green
  };
  
  // Emoji based on severity
  const emojis = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const embed = {
    title: `${emojis[payload.severity]} ${payload.title}`,
    description: payload.message,
    color: colors[payload.severity],
    timestamp: payload.timestamp,
    fields: [
      {
        name: 'Component',
        value: payload.component,
        inline: true
      },
      {
        name: 'Severity',
        value: payload.severity.toUpperCase(),
        inline: true
      }
    ],
    footer: {
      text: 'MoltOS Alert System'
    }
  };
  
  if (payload.details) {
    embed.fields.push({
      name: 'Details',
      value: '```json\n' + JSON.stringify(payload.details, null, 2).substring(0, 1000) + '\n```',
      inline: false
    });
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Alert] Discord webhook failed:', error);
    return false;
  }
}

/**
 * Send PagerDuty alert
 */
async function sendPagerDutyAlert(payload: AlertPayload): Promise<boolean> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    console.log('[Alert] PagerDuty not configured, skipping');
    return false;
  }
  
  const severityMap = {
    critical: 'critical',
    warning: 'warning',
    info: 'info'
  };
  
  const event = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: `${payload.component}-${Date.now()}`,
    payload: {
      summary: `[MoltOS] ${payload.title}: ${payload.component}`,
      severity: severityMap[payload.severity],
      source: 'moltos-health-monitor',
      component: payload.component,
      custom_details: {
        message: payload.message,
        ...payload.details
      }
    }
  };
  
  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Alert] PagerDuty failed:', error);
    return false;
  }
}

/**
 * Check if alert should be throttled
 */
async function shouldThrottle(component: string, severity: string): Promise<boolean> {
  const { data: lastAlert } = await getSupabase()
    .from('alert_history')
    .select('created_at')
    .eq('component', component)
    .eq('severity', severity)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!lastAlert) return false;
  
  const lastTime = new Date(lastAlert.created_at).getTime();
  const now = Date.now();
  
  return (now - lastTime) < ALERT_CONFIG.cooldownMs;
}

/**
 * Record alert in database
 */
async function recordAlert(payload: AlertPayload, sent: { discord: boolean; pagerduty: boolean }) {
  await getSupabase()
    .from('alert_history')
    .insert([{
      severity: payload.severity,
      component: payload.component,
      title: payload.title,
      message: payload.message,
      details: payload.details,
      discord_sent: sent.discord,
      pagerduty_sent: sent.pagerduty,
      created_at: payload.timestamp
    }]);
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * POST /api/alerts/send
 * Send an alert (internal use or manual triggers)
 * 
 * Body:
 * {
 *   severity: 'critical' | 'warning' | 'info',
 *   component: string,
 *   title: string,
 *   message: string,
 *   details?: object,
 *   skipThrottle?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting - alerts can be spammy
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/alerts');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const body = await request.json();
    const { severity, component, title, message, details, skipThrottle } = body;
    
    // Validate required fields
    if (!severity || !component || !title || !message) {
      return NextResponse.json({
        success: false,
        error: 'severity, component, title, and message required'
      }, { status: 400 });
    }
    
    // Check throttling
    if (!skipThrottle) {
      const throttled = await shouldThrottle(component, severity);
      if (throttled) {
        return NextResponse.json({
          success: false,
          error: 'Alert throttled (cooldown active)',
          retry_after_seconds: Math.ceil(ALERT_CONFIG.cooldownMs / 1000)
        }, { status: 429 });
      }
    }
    
    const payload: AlertPayload = {
      severity,
      component,
      title,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    // Send to all configured channels
    const [discordSent, pagerdutySent] = await Promise.all([
      sendDiscordAlert(payload),
      sendPagerDutyAlert(payload)
    ]);
    
    // Record in database
    await recordAlert(payload, { discord: discordSent, pagerduty: pagerdutySent });
    
    const response = NextResponse.json({
      success: true,
      sent: {
        discord: discordSent,
        pagerduty: pagerdutySent
      },
      timestamp: payload.timestamp
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('[Alert] Failed to send:', error);
    const response = NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  }
}

/**
 * GET /api/alerts/history
 * Get alert history
 * 
 * Query:
 *   component: filter by component
 *   severity: filter by severity
 *   limit: number of results (default 50, max 100)
 *   since: ISO timestamp for start date
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/alerts');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');
    const severity = searchParams.get('severity');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const since = searchParams.get('since');
    
    let query = getSupabase()
      .from('alert_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (component) query = query.eq('component', component);
    if (severity) query = query.eq('severity', severity);
    if (since) query = query.gte('created_at', since);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Get summary stats
    const { data: stats } = await getSupabase()
      .from('alert_history')
      .select('severity', { count: 'exact' });
    
    const summary = {
      total: stats?.length || 0,
      critical: stats?.filter(s => s.severity === 'critical').length || 0,
      warning: stats?.filter(s => s.severity === 'warning').length || 0,
      info: stats?.filter(s => s.severity === 'info').length || 0
    };
    
    const response = NextResponse.json({
      success: true,
      alerts: data || [],
      summary,
      filters: { component, severity, since }
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    const response = NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  }
}

/**
 * DELETE /api/alerts/history
 * Clear old alerts (admin only)
 * 
 * Body:
 * {
 *   before: ISO timestamp,
 *   severity?: string  -- optional, clear only specific severity
 * }
 */
export async function DELETE(request: NextRequest) {
  // Apply rate limiting - destructive operation, stricter limits
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/alerts');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const body = await request.json();
    const { before, severity } = body;
    
    if (!before) {
      const response = NextResponse.json({
        success: false,
        error: 'before timestamp required'
      }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let query = getSupabase()
      .from('alert_history')
      .delete()
      .lt('created_at', before);
    
    if (severity) query = query.eq('severity', severity);
    
    const { error, count } = await query;
    
    if (error) throw error;
    
    const response = NextResponse.json({
      success: true,
      deleted: count || 0,
      before
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    const response = NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
  }
}
