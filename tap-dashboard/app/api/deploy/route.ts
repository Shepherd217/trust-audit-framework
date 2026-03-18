import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Type definitions
interface Agent {
  agent_id: string
  name: string
}

interface Swarm {
  id: string
}

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
  return signature.length > 0 && publicKey.length > 0
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify ClawID signature
    const payload = { swarm_name, provider, timestamp }
    const isValid = await verifyClawIDSignature(public_key, signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('agent_id, name')
      .eq('public_key', public_key)
      .single() as { data: Agent | null; error: any }

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Generate deployment config
    const deploymentConfig = provider === 'fly' 
      ? generateFlyConfig(swarm_name, public_key)
      : generateHelmConfig(swarm_name, public_key)

    // Create swarm record
    const { data: swarm, error: swarmError } = await supabase
      .from('swarms')
      .insert({
        name: swarm_name,
        owner_id: agent.agent_id,
        provider,
        config: deploymentConfig,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single() as { data: Swarm | null; error: any }

    if (swarmError || !swarm) {
      console.error('Failed to create swarm:', swarmError)
      return NextResponse.json(
        { error: 'Failed to create swarm record' },
        { status: 500 }
      )
    }

    // In production, this would trigger actual deployment
    // For now, return the config and instructions

    return NextResponse.json({
      success: true,
      swarm: {
        id: swarm.id,
        name: swarm_name,
        provider,
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
    })
  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json(
      { error: 'Deployment failed' },
      { status: 500 }
    )
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
