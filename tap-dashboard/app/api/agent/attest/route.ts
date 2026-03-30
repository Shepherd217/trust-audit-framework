import { NextRequest, NextResponse } from 'next/server'
import { flagViolation } from '@/lib/security-violations';
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

    const { target_agents, scores, reason, boot_hash_verified, attester_id } = body;

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

    // ── Sybil Protection ──────────────────────────────────────────────────────
    // Attestation requires a completed marketplace contract between the two agents.
    // This makes reputation circular rings economically costly — you must have
    // done real paid work together. Founding agents (in the legacy `agents` table)
    // are exempt during the bootstrap period.
    const supabaseClient = getSupabase() as any;
    const sanitizedAttesterId = sanitizeString(attester_id || '');

    // Block self-attestation — TAP must come from peers
    if (sanitizedAttesterId && Array.isArray(target_agents) && target_agents.includes(sanitizedAttesterId)) {
      try { await flagViolation(sanitizedAttesterId, 'self_attest', { target_agents }, '/agent/attest') } catch {}
      return NextResponse.json({
        error: 'Cannot attest yourself — TAP must be earned from peers',
        code: 'SELF_ATTEST_BLOCKED',
      }, { status: 400 })
    }

    if (sanitizedAttesterId) {
      // Check if attester is a founding/legacy agent (exempt from requirement)
      const { data: foundingAgent } = await supabaseClient
        .from('agents')
        .select('agent_id')
        .eq('agent_id', sanitizedAttesterId)
        .single();

      if (!foundingAgent) {
        // Not a founding agent — must have a completed contract with each target
        for (const target_agent_id of target_agents) {
          const { data: contract } = await supabaseClient
            .from('marketplace_contracts')
            .select('id')
            .or(
              `and(hirer_id.eq.${sanitizedAttesterId},worker_id.eq.${target_agent_id}),` +
              `and(hirer_id.eq.${target_agent_id},worker_id.eq.${sanitizedAttesterId})`
            )
            .limit(1)

          if (!contract || contract.length === 0) {
            const response = NextResponse.json(
              {
                error: 'Attestation requires a completed marketplace job between both agents. This prevents reputation farming.',
                code: 'NO_SHARED_JOB',
                detail: `No contract found between ${sanitizedAttesterId} and ${target_agent_id}. Complete a paid job together first.`,
              },
              { status: 403 }
            )
            Object.entries(rateLimitHeaders).forEach(([key, value]) => { response.headers.set(key, value) })
            return applySecurityHeaders(response)
          }
        }
      }
    }
    // ── End Sybil Protection ──────────────────────────────────────────────────

    // Record attestations and update reputation
    const results = [];
    for (let i = 0; i < target_agents.length; i++) {
      const agent_id = target_agents[i];
      const score = typeof validatedScores[i] === 'number' 
        ? Math.max(0, Math.min(100, validatedScores[i])) 
        : 50;

      // Try agent_registry first (new agents registered via API go here)
      const { data: regAgent } = await supabaseClient
        .from('agent_registry')
        .select('agent_id')
        .eq('agent_id', agent_id)
        .single();

      if (regAgent) {
        await supabaseClient
          .from('agent_registry')
          .update({ reputation: score, last_seen_at: new Date().toISOString() })
          .eq('agent_id', agent_id);
      } else {
        await supabaseClient
          .from('agents')
          .update({ reputation: score })
          .eq('agent_id', agent_id);
      }

      // Record attestation as successful regardless
      results.push({ agent_id, success: true, score });
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
