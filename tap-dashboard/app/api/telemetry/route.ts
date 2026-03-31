/**
 * Agent Telemetry API
 *
 * POST /api/telemetry/submit - Agents report their metrics
 * GET /api/telemetry - Retrieve telemetry for an agent
 * GET /api/telemetry/leaderboard - Top performers by telemetry
 *
 * Inspired by NVIDIA NeMo Agent Toolkit's observability,
 * but designed for trust scoring, not just debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

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

interface TelemetryPayload {
  agent_id: string;
  window_start: string; // ISO timestamp
  window_end: string;
  tasks?: {
    attempted: number;
    completed: number;
    failed: number;
    avg_duration_ms?: number;
    p95_duration_ms?: number;
    p99_duration_ms?: number;
  };
  resources?: {
    cpu_percent?: number;
    memory_mb?: number;
  };
  network?: {
    requests: number;
    errors: number;
  };
  custom?: Record<string, number | string | boolean>;
}

interface TelemetryResponse {
  success: boolean;
  telemetry_id?: string;
  composite_score?: number;
  message?: string;
}

// Rate limit: 60 telemetry submissions per minute per IP (1 per second)
const MAX_BODY_SIZE_KB = 100;
const MAX_AGENT_ID_LENGTH = 100;

/**
 * POST /api/telemetry/submit
 * Agents report their telemetry data
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting - prevents data poisoning via spam
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/telemetry');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json({
        success: false,
        error: sizeCheck.error
      }, { status: 413 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const body: TelemetryPayload = JSON.parse(bodyText);

    // Validate required fields
    if (!body.agent_id || !body.window_start || !body.window_end) {
      const response = NextResponse.json({
        success: false,
        error: 'agent_id, window_start, and window_end required'
      }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate agent_id format
    if (typeof body.agent_id !== 'string' || body.agent_id.length > MAX_AGENT_ID_LENGTH) {
      const response = NextResponse.json({
        success: false,
        error: `agent_id must be a string with max ${MAX_AGENT_ID_LENGTH} chars`
      }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Verify agent exists
    const { data: agent, error: agentError } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name')
      .eq('agent_id', body.agent_id)
      .single();

    if (agentError || !agent) {
      const response = NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Submit telemetry via RPC
    const { data: telemetryId, error: telemetryError } = await getSupabase()
      .rpc('submit_agent_telemetry', {
        p_agent_id: body.agent_id,
        p_window_start: body.window_start,
        p_window_end: body.window_end,
        p_tasks_attempted: body.tasks?.attempted || 0,
        p_tasks_completed: body.tasks?.completed || 0,
        p_tasks_failed: body.tasks?.failed || 0,
        p_avg_task_duration_ms: body.tasks?.avg_duration_ms,
        p_cpu_percent: body.resources?.cpu_percent,
        p_memory_mb: body.resources?.memory_mb,
        p_network_requests: body.network?.requests || 0,
        p_network_errors: body.network?.errors || 0,
        p_custom_metrics: body.custom || {}
      });

    if (telemetryError) throw telemetryError;

    // Get updated composite score
    const { data: scoreData } = await getSupabase()
      .from('tap_score_with_telemetry')
      .select('composite_score')
      .eq('agent_id', body.agent_id)
      .single();

    const result: TelemetryResponse = {
      success: true,
      telemetry_id: telemetryId,
      composite_score: scoreData?.composite_score
    };

    const response = NextResponse.json(result);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);

  } catch (error) {
    console.error('[Telemetry] Submit failed:', error);
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
 * GET /api/telemetry
 * Get telemetry summary for an agent
 *
 * Query:
 *   agent_id: required
 *   days: number of days to include (default 7, max 30)
 *   include_windows: include raw telemetry windows (default false)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/telemetry');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    let agentId = searchParams.get('agent_id');
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);
    const includeWindows = searchParams.get('include_windows') === 'true';

    // Resolve from API key if not in query
    if (!agentId) {
      const apiKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key')
      if (apiKey) {
        const { createHash } = require('crypto')
        const hash = createHash('sha256').update(apiKey).digest('hex')
        const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
        agentId = (data as any)?.agent_id || null
      }
    }

    if (!agentId) {
      const response = NextResponse.json({
        success: false,
        error: 'agent_id required (or pass Authorization: Bearer <api_key>)'
      }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Get summary via RPC
    const { data: summary, error: summaryError } = await getSupabase()
      .rpc('get_agent_telemetry_summary', {
        p_agent_id: agentId,
        p_days: days
      });

    if (summaryError) throw summaryError;

    const response: any = {
      success: true,
      summary: summary
    };

    // Include raw windows if requested
    if (includeWindows) {
      const { data: windows, error: windowsError } = await getSupabase()
        .from('agent_telemetry')
        .select('*')
        .eq('agent_id', agentId)
        .gte('window_start', new Date(Date.now() - days * 86400000).toISOString())
        .order('window_start', { ascending: false })
        .limit(100);

      if (!windowsError) {
        response.windows = windows;
      }
    }

    // Include current MOLT score with telemetry
    const { data: scoreData } = await getSupabase()
      .from('tap_score_with_telemetry')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (scoreData) {
      response.current_score = {
        tap_score: scoreData.tap_score,
        composite_score: scoreData.composite_score,
        reliability: scoreData.telemetry_reliability,
        success_rate: scoreData.telemetry_success_rate
      };
    }

    const httpResponse = NextResponse.json(response);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      httpResponse.headers.set(key, value);
    });
    return applySecurityHeaders(httpResponse);

  } catch (error) {
    console.error('[Telemetry] Get failed:', error);
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
