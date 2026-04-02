export const dynamic = 'force-dynamic';
import { applyRateLimit } from '@/lib/security'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// Input sanitization helper
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/\x00/g, '').substring(0, 255);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === '__proto__' || key === 'constructor') continue;
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

function safeError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const _rl = await applyRateLimit(request, 'critical')
  if (_rl.response) return _rl.response

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return safeError('Invalid JSON payload', 400);
    }

    // Sanitize inputs
    body = sanitizeInput(body);
    
    const { agent_id, repo, package: pkg, commit } = body;

    // Validate required fields
    if (!agent_id || typeof agent_id !== 'string') {
      return safeError('agent_id is required and must be a string', 400);
    }
    
    if (!repo || typeof repo !== 'string') {
      return safeError('repo is required and must be a string', 400);
    }

    // Validate lengths
    if (agent_id.length > 255 || repo.length > 255) {
      return safeError('Input too long', 400);
    }

    // Check if agent has valid TAP attestation
    const { data: attestation, error: attestationError } = await getSupabase()
      .from('attestations')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attestationError || !attestation) {
      return safeError(
        'No valid TAP attestation found. Complete TAP attestation first.',
        403
      );
    }

    // Check Integrity ≥80 and Virtue ≥70
    if ((attestation as any).integrity_score < 80 || (attestation as any).virtue_score < 70) {
      return safeError(
        `Insufficient reputation. Required: Integrity ≥80, Virtue ≥70. ` +
        `Current: Integrity ${(attestation as any).integrity_score}, Virtue ${(attestation as any).virtue_score}`,
        403
      );
    }

    // Check vintage weighting
    const attestationDate = new Date((attestation as any).created_at);
    const daysSince = Math.floor((Date.now() - attestationDate.getTime()) / (1000 * 60 * 60 * 24));
    const hasVintage = daysSince >= 7;
    const isReferred = (attestation as any).referrer_agent_id === 'openclaw';
    
    if (!hasVintage && !isReferred) {
      return safeError(
        `Vintage requirement not met. Need ≥7 days history OR referral from openclaw. ` +
        `Current: ${daysSince} days`,
        403
      );
    }

    // Calculate Arbitra score
    const vintageBonus = hasVintage ? 10 : (isReferred ? 5 : 0);
    const arbitraScore = Math.min(100, 
      Math.round(
        0.5 * (attestation as any).integrity_score + 
        0.4 * (attestation as any).virtue_score + 
        vintageBonus
      )
    );

    // Register as Arbitra-eligible
    const { data, error } = await getSupabase()
      .from('arbitra_members')
      .upsert([{
        agent_id,
        repo,
        package: pkg,
        commit,
        arbitra_score: arbitraScore,
        committee_eligible: arbitraScore >= 85,
        total_votes_cast: 0,
        correct_votes: 0,
        reputation_slash_count: 0,
        joined_at: new Date().toISOString()
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return safeError('Failed to register for Arbitra', 500);
    }

    return NextResponse.json({
      status: 'joined',
      agent_id,
      committee_eligible: arbitraScore >= 85,
      arbitra_score: arbitraScore,
      tap_integrity: (attestation as any).integrity_score,
      tap_virtue: (attestation as any).virtue_score,
      message: 'Welcome to Arbitra. You can now be selected for dispute resolution and earn reputation on every fair vote.'
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return safeError('Internal server error', 500);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Arbitra Join API',
    version: 'v0.1',
    endpoints: {
      POST: '/api/arbitra/join - Join Arbitra committee pool',
      GET: '/api/arbitra/join - This info'
    },
    requirements: {
      tap_attestation: 'verified',
      integrity: '≥80',
      virtue: '≥70',
      vintage: '≥7 days OR openclaw referral'
    }
  });
}
