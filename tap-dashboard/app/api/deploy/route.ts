import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Agent = Tables<'agents'>
type Swarm = Tables<'swarms'>

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
    const verification = await verifyClawIDSignature(public_key, signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up agent
    const agentResult = await supabase
      .from('user_agents')
      .select('id, name')
      .eq('public_key', public_key)
      .single()
    
    const agent = agentResult.data as Agent | null

    if (agentResult.error || !agent) {
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
    const insertData: TablesInsert<'swarms'> = {
      name: swarm_name,
      user_id: agent.id,
      agent_ids: [agent.id],
      config: deploymentConfig as any,
      status: 'pending',
    }
    
    const swarmResult = await supabase
      .from('swarms')
      .insert(insertData)
      .select()
      .single()
    
    const swarm = swarmResult.data as Swarm | null

    if (swarmResult.error || !swarm) {
      console.error('Failed to create swarm:', swarmResult.error)
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
