import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyClawIDSignature } from '@/lib/clawid-auth';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase not configured");
    supabase = createClient(url, key);
  }
  return supabase;
}
// Old:
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * DELETE /api/claw/cloud/deploy/[id]
 * Destroy a deployment and clean up resources
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get auth from query params for DELETE
    const publicKey = searchParams.get('public_key');
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');

    if (!publicKey || !signature) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    // Verify signature
    const payload = { action: 'destroy_deployment', deployment_id: id, timestamp: parseInt(timestamp || '0') };
    const verification = await verifyClawIDSignature(publicKey, signature, payload);
    
    if (!verification.valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Get deployment
    const { data: deployment, error } = await supabase
      .from('clawcloud_deployments')
      .select('*')
      .eq('deployment_id', id)
      .single();

    if (error || !deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: agent } = await supabase
      .from('user_agents')
      .select('id, public_key')
      .eq('id', deployment.agent_id)
      .single();

    if (!agent || agent.public_key !== publicKey) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update status to destroying
    await supabase.rpc('update_deployment_status', {
      p_deployment_id: id,
      p_status: 'destroying',
    });

    // Log
    await supabase.rpc('log_deployment_event', {
      p_deployment_id: deployment.id,
      p_level: 'info',
      p_message: `Deployment ${id} destroyed by user`,
    });

    // Update to destroyed
    await supabase.rpc('update_deployment_status', {
      p_deployment_id: id,
      p_status: 'destroyed',
    });

    return NextResponse.json({
      success: true,
      message: `Deployment ${id} destroyed`,
    });

  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
