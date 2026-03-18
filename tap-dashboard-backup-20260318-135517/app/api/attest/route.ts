import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
function safeError(message: string, status: number = 400) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return safeError('Invalid JSON payload', 400);
    }

    // Sanitize all inputs
    body = sanitizeInput(body);
    
    const { repo, package: pkg, commit, agent_id, report } = body;

    // Validate required fields
    if (!repo || typeof repo !== 'string') {
      return safeError('repo is required and must be a string', 400);
    }
    
    if (!commit || typeof commit !== 'string') {
      return safeError('commit is required and must be a string', 400);
    }

    // Validate string lengths
    if (repo.length > 255 || commit.length > 255) {
      return safeError('Input too long', 400);
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
      return safeError('Failed to create attestation', 500);
    }

    // Return success
    return NextResponse.json({
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

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return safeError('Internal server error', 500);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'TAP Attestation API',
    version: 'v0.1',
    endpoints: {
      POST: '/api/attest - Submit attestation',
      GET: '/api/attest - This info'
    }
  });
}
