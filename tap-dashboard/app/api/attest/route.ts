import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  applyRateLimit, 
  applySecurityHeaders,
  validateBodySize
} from '@/lib/security';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

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

// Rate limit configuration
const RATE_LIMIT = { requests: 10, windowMs: 60 * 1000 }; // 10 per minute
const MAX_BODY_SIZE_KB = 500; // 500KB max for reports

// Input sanitization helper
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove null bytes, limit length
    return input.replace(/\x00/g, '').substring(0, 255);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor') continue;
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

// Safe error response (don't expose schema)
function safeError(message: string, status: number = 400, headers?: Record<string, string>) {
  const response = NextResponse.json(
    { error: message },
    { status }
  );
  
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return applySecurityHeaders(response);
}

export async function POST(request: NextRequest) {
  const path = '/api/attest';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    // Read body text for size validation
    const bodyText = await request.text();
    
    // Validate body size
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      return safeError(sizeCheck.error!, 413, rateLimitHeaders);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return safeError('Invalid JSON payload', 400, rateLimitHeaders);
    }

    // Sanitize all inputs
    body = sanitizeInput(body);
    
    const { repo, package: pkg, commit, agent_id, report } = body;

    // Validate required fields
    if (!repo || typeof repo !== 'string') {
      return safeError('repo is required and must be a string', 400, rateLimitHeaders);
    }
    
    if (!commit || typeof commit !== 'string') {
      return safeError('commit is required and must be a string', 400, rateLimitHeaders);
    }

    // Validate string lengths
    if (repo.length > 255 || commit.length > 255) {
      return safeError('Input too long', 400, rateLimitHeaders);
    }

    // Calculate Integrity from report
    const integrityScore = report?.scores?.dependency === 100 &&
                          report?.scores?.telemetry === 100 &&
                          report?.scores?.scope === 100 ? 100 : 0;

    // Initial Virtue (will be updated by RBTS after interactions)
    const virtueScore = 70; // Bootstrap value

    // Total Reputation
    const totalReputation = Math.round(0.6 * integrityScore + 0.4 * virtueScore);

    // Insert attestation record
    const { data, error } = await (getSupabase() as any)
      .from('attestations')
      .insert([{
        repo,
        package: pkg,
        commit,
        agent_id: agent_id || 'unknown',
        integrity_score: integrityScore,
        virtue_score: virtueScore,
        total_reputation: totalReputation,
        report: report || {},
        status: integrityScore === 100 ? 'verified' : 'failed',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return safeError('Failed to create attestation', 500, rateLimitHeaders);
    }

    // Return success with security headers
    const response = NextResponse.json({
      success: true,
      attestation: {
        id: data.id,
        repo,
        commit,
        integrity_score: integrityScore,
        virtue_score: virtueScore,
        total_reputation: totalReputation,
        status: integrityScore === 100 ? 'verified' : 'failed'
      },
      message: integrityScore === 100 
        ? '✅ Accepted into TAP! Welcome to the trust layer.'
        : '❌ Preflight failed. Check issues and resubmit.'
    });
    
    // Add rate limit headers
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return safeError('Internal server error', 500, rateLimitHeaders);
  }
}

export async function GET(request: NextRequest) {
  const path = '/api/attest';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  const response = NextResponse.json({
    status: 'TAP Attestation API',
    version: 'v0.1',
    endpoints: {
      POST: '/api/attest - Submit attestation (10 req/min)',
      GET: '/api/attest - This info'
    },
    limits: {
      maxBodySizeKB: MAX_BODY_SIZE_KB,
      rateLimit: '10 requests per minute'
    }
  });
  
  // Add rate limit headers
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return applySecurityHeaders(response);
}
