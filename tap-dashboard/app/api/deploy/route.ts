export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Agent = Tables<'agents'>
type Swarm = Tables<'swarms'>

// Rate limit: 5 deployments per minute per IP
const MAX_BODY_SIZE_KB = 500; // 500KB max for config

export async function POST(request: NextRequest) {
  const path = '/api/deploy';
  
  // Apply rate limiting
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    const {
      swarm_name,
      config, // fly.toml or helm values
      provider = 'fly', // 'fly' or 'helm'
      // ClawID auth
      public_key,
      signature,
      timestamp,
    } = body

    if (!swarm_name || !public_key || !signature) {
      const response = NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate swarm_name format (alphanumeric, hyphens, max 63 chars)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/.test(swarm_name)) {
      const response = NextResponse.json(
        { error: 'Invalid swarm_name format. Must start with alphanumeric, max 63 chars, alphanumeric and hyphens only.' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Validate provider
    if (provider !== 'fly' && provider !== 'helm') {
      const response = NextResponse.json(
        { error: 'Invalid provider. Use: fly or helm' },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }

    // Verify ClawID signature
    const payload = { swarm_name, provider, timestamp }
    const verification = await verifyClawIDSignature(public_key, signature, payload)
    
    if (!verification.valid) {
      const response = NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      );
      return applySecurityHeaders(response);
    }

    // Look up agent
    const agentResult = await supabase
      .from('agents')
      .select('agent_id, name')
      .eq('public_key', public_key)
      .maybeSingle()
    
    const agent = agentResult.data as Agent | null

    if (agentResult.error || !agent) {
      const response = NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
      return applySecurityHeaders(response);
    }

    // Generate deployment config
    const deploymentConfig = provider === 'fly' 
      ? generateFlyConfig(swarm_name, public_key)
      : generateHelmConfig(swarm_name, public_key)

    // Create swarm record
    const insertData: TablesInsert<'swarms'> = {
      name: swarm_name,
      user_id: agent.agent_id,
      agent_ids: [agent.agent_id],
      config: deploymentConfig as any,
      status: 'pending',
    }
    
    const swarmResult = await supabase
      .from('swarms')
      .insert(insertData)
      .select()
      .maybeSingle()
    
    const swarm = swarmResult.data as Swarm | null

    if (swarmResult.error || !swarm) {
      console.error('Failed to create swarm:', swarmResult.error)
      const response = NextResponse.json(
        { error: 'Failed to create swarm record' },
        { status: 500 }
      );
      return applySecurityHeaders(response);
    }

    // In production, this would trigger actual deployment
    // For now, return the config and instructions

    const response = NextResponse.json({
      success: true,
      swarm: {
        id: swarm.id,
        name: swarm_name,
        status: 'pending',
      },
      deployment: {
        config: deploymentConfig,
        instructions: provider === 'fly' 
          ? `Run: fly deploy --config fly.toml`
          : `Run: helm install ${swarm_name} ./chart`,
        estimated_time: '2-3 minutes',
      },
      next_steps: [
        'Download the generated config',
        'Run the deployment command',
        'Monitor status at /dashboard',
      ],
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Deploy error:', error)
    const response = NextResponse.json(
      { error: 'Deployment failed' },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}

function generateFlyConfig(swarmName: string, publicKey: string) {
  return `# Auto-generated Fly.io config for ${swarmName}
app = "${swarmName.toLowerCase().replace(/[^a-z0-9]/g, '-')}"
primary_region = "iad"

[build]
  image = "moltos/clawvm:latest"

[env]
  CLAWID_PUBLIC_KEY = "${publicKey}"
  MOLTOS_ENV = "production"

[[mounts]]
  source = "clawfs_data"
  destination = "/app/clawfs_data"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 512
`
}

function generateHelmConfig(swarmName: string, publicKey: string) {
  return `# Helm values for ${swarmName}
replicaCount: 1

image:
  repository: moltos/clawvm
  tag: latest
  pullPolicy: IfNotPresent

nameOverride: "${swarmName}"

env:
  CLAWID_PUBLIC_KEY: "${publicKey}"
  MOLTOS_ENV: "production"

persistence:
  enabled: true
  storageClass: "standard"
  accessMode: ReadWriteOnce
  size: 10Gi
  mountPath: /app/clawfs_data

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
`
}
