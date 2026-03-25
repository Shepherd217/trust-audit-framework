import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  applyRateLimit, 
  applySecurityHeaders,
  validateBodySize,
  validateArrayLength
} from '@/lib/security';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

// Limits
const MAX_BODY_SIZE_KB = 100;
const MAX_TARGET_AGENTS = 100;

// Input sanitization
function sanitizeString(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\x00/g, '').substring(0, 1000);
}

export async function POST(request: NextRequest) {
  const path = '/api/agent/attest';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json({ error: sizeCheck.error }, { status: 413 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const { target_agents, scores, reason, boot_hash_verified } = body;

    // Validate target_agents
    if (!target_agents || !Array.isArray(target_agents)) {
      const response = NextResponse.json({ error: 'target_agents array required' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate array length
    const agentLimit = validateArrayLength(target_agents, MAX_TARGET_AGENTS, 'target_agents');
    if (!agentLimit.valid) {
      const response = NextResponse.json({ error: agentLimit.error }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate all agent IDs are strings
    for (const agent_id of target_agents) {
      if (typeof agent_id !== 'string' || agent_id.length > 255) {
        const response = NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
    }

    // Validate scores if provided
    const validatedScores = scores || [];
    if (!Array.isArray(validatedScores)) {
      const response = NextResponse.json({ error: 'scores must be an array' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Sanitize reason
    const sanitizedReason = sanitizeString(reason);

    // Record attestations and update reputation
    const results = [];
    for (let i = 0; i < target_agents.length; i++) {
      const agent_id = target_agents[i];
      const score = typeof validatedScores[i] === 'number' 
        ? Math.max(0, Math.min(100, validatedScores[i])) 
        : 50;

      const { data, error } = await (getSupabase() as any)
        .from('agents')
        .update({
          reputation: score
        })
        .eq('agent_id', agent_id)
        .select();

      if (error) {
        console.error(`Failed to update agent ${agent_id}:`, error);
        results.push({ agent_id, success: false, error: error.message });
      } else {
        results.push({ agent_id, success: true, score });
      }
    }

    // Trigger EigenTrust recalculation asynchronously (don't await)
    fetch('https://moltos.org/api/eigentrust', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(e => {
      console.log('EigenTrust trigger skipped:', e);
    });

    const successCount = results.filter((r: any) => r.success).length;
    
    const response = NextResponse.json({
      success: true,
      attested_count: successCount,
      total_requested: target_agents.length,
      results,
      message: `Attestations recorded: ${successCount}/${target_agents.length} agents updated`
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Attest error:', error);
    const response = NextResponse.json({ error: 'Server error' }, { status: 500 });
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

export async function GET(request: NextRequest) {
  const path = '/api/agent/attest';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  const response = NextResponse.json({
    status: 'Agent Attestation API',
    version: 'v0.1',
    limits: {
      maxAgents: MAX_TARGET_AGENTS,
      rateLimit: '10 requests per minute'
    }
  });
  
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return applySecurityHeaders(response);
}
