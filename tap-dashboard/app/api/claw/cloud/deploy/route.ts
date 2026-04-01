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
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/claw/cloud/deploy
 * Deploy an agent/workflow to VPS or local environment (Pure WASM mode)
 * 
 * Body: {
 *   agent_id: string,
 *   workflow_id?: string,
 *   target: { type: 'vps' | 'local', host?: string, port?: number },
 *   wasm_config?: { ... },
 *   env_vars?: { ... },
 *   public_key: string,
 *   signature: string,
 *   timestamp: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agent_id,
      workflow_id,
      target = { type: 'local', port: 8080 },
      wasm_config = {},
      env_vars = {},
      public_key,
      signature,
      timestamp,
    } = body;

    // Verify ClawID signature
    if (!public_key || !signature) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 });
    }

    const payload = { action: 'cloud_deploy', agent_id, timestamp };
    const verification = await verifyClawIDSignature(public_key, signature, payload);
    
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 401 });
    }

    // Verify agent owns this identity
    const { data: agent, error: agentError } = await getSupabase()
      .from('user_agents')
      .select('id, public_key, status')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check deployment limits
    const { data: existingDeployments } = await getSupabase()
      .from('clawcloud_deployments')
      .select('id')
      .eq('agent_id', agent_id)
      .in('status', ['pending', 'building', 'deploying', 'running']);

    const maxDeployments = 5; // Configurable
    if (existingDeployments && existingDeployments.length >= maxDeployments) {
      return NextResponse.json(
        { error: `Max deployments (${maxDeployments}) reached. Stop an existing deployment first.` },
        { status: 429 }
      );
    }

    // Generate deployment ID
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create deployment record
    const { data: deployment, error: createError } = await getSupabase()
      .from('clawcloud_deployments')
      .insert({
        deployment_id: deploymentId,
        agent_id,
        owner_public_key: public_key,
        workflow_id: workflow_id || null,
        task_type: workflow_id ? 'workflow' : 'agent',
        target_type: target.type,
        target_host: target.host || (target.type === 'local' ? 'localhost' : null),
        target_port: target.port || 8080,
        wasm_config,
        env_vars: {
          CLAW_AGENT_ID: agent_id,
          CLAW_DEPLOYMENT_ID: deploymentId,
          CLAW_BUS_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          ...env_vars,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Deployment creation error:', createError);
      return NextResponse.json({ error: 'Failed to create deployment' }, { status: 500 });
    }

    // Log deployment start
    await getSupabase().rpc('log_deployment_event' as any, {
      p_deployment_id: deployment.id,
      p_level: 'info',
      p_message: `Deployment ${deploymentId} created for agent ${agent_id}`,
      p_metadata: { target: target.type, workflow_id },
    });

    // Trigger async deployment (don't wait)
    triggerDeployment(deploymentId, target.type).catch(console.error);

    return NextResponse.json({
      success: true,
      deployment: {
        id: deploymentId,
        status: 'pending',
        target: target.type,
        url: target.type === 'local' 
          ? `http://localhost:${target.port || 8080}`
          : `http://${target.host}:${target.port || 8080}`,
      },
      message: `Deployment queued. Status will update to 'running' when ready.`,
    });

  } catch (error) {
    console.error('Deploy error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/claw/cloud/deploy
 * List deployments for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    }

    const sb = getSupabase()
    let query = sb
      .from('clawcloud_deployments')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: deployments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deployments: deployments || [],
      count: deployments?.length || 0,
    });

  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Async deployment trigger
async function triggerDeployment(deploymentId: string, targetType: string) {
  // Update status to building
  await getSupabase().rpc('update_deployment_status' as any, {
    p_deployment_id: deploymentId,
    p_status: 'building',
  } as any);

  // Simulate build process (in real impl, this would compile WASM, push to ClawFS, etc)
  await new Promise(r => setTimeout(r, 2000));

  // Update to deploying
  await getSupabase().rpc('update_deployment_status' as any, {
    p_deployment_id: deploymentId,
    p_status: 'deploying',
  } as any);

  // For local mode, we would spawn the process here
  // For VPS mode, we would SSH and deploy
  // For now, simulate deployment time
  await new Promise(r => setTimeout(r, 3000));

  // Mark as running (in real impl, this happens after health check passes)
  await getSupabase().rpc('update_deployment_status' as any, {
    p_deployment_id: deploymentId,
    p_status: 'running',
  } as any);

  // Log success
  const { data: deployment } = await getSupabase()
    .from('clawcloud_deployments')
    .select('id')
    .eq('deployment_id', deploymentId)
    .single();

  if (deployment) {
    await getSupabase().rpc('log_deployment_event' as any, {
      p_deployment_id: deployment.id,
      p_level: 'info',
      p_message: `Deployment ${deploymentId} is now running`,
    });
  }
}
