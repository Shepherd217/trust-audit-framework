export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { verifyClawIDSignature } from '@/lib/clawid-auth';

let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured");
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/claw/cloud/deploy/[id]/stop
 * Stop a running deployment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { public_key, signature, timestamp } = body;

    // Verify signature
    const payload = { action: 'stop_deployment', deployment_id: id, timestamp };
    const verification = await verifyClawIDSignature(public_key, signature, payload);
    
    if (!verification.valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Get deployment
    const { data: deployment, error } = await getSupabase()
      .from('clawcloud_deployments')
      .select('*')
      .eq('deployment_id', id)
      .maybeSingle();

    if (error || !deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: agent } = await getSupabase()
      .from('user_agents')
      .select('id, public_key')
      .eq('id', deployment.agent_id)
      .maybeSingle();

    if (!agent || agent.public_key !== public_key) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update status
    await getSupabase().rpc('update_deployment_status' as any, {
      p_deployment_id: id,
      p_status: 'stopped',
    } as any);

    // Log
    await getSupabase().rpc('log_deployment_event' as any, {
      p_deployment_id: deployment.id,
      p_level: 'info',
      p_message: `Deployment ${id} stopped by user`,
    });

    return NextResponse.json({
      success: true,
      message: `Deployment ${id} stopped`,
    });

  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
