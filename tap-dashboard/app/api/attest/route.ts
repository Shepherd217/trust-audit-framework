import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repo, package: pkg, commit, agent_id, report } = body;

    // Validate required fields
    if (!repo || !commit) {
      return NextResponse.json(
        { error: 'repo and commit required' },
        { status: 400 }
      );
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
    const { data, error } = await supabase
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
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
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
