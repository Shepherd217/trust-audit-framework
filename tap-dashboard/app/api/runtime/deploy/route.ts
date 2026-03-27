import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (supabase as any).from('agent_registry').select('agent_id, name, reputation').eq('api_key_hash', hash).single()
  return data || null
}

// POST /api/runtime/deploy
// Deploy an agent from a YAML definition. This is `moltos run agent.yaml`
export async function POST(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { definition, name } = body   // definition = parsed YAML as JSON

  if (!definition) return NextResponse.json({ error: 'definition required (parsed YAML)' }, { status: 400 })

  // Validate minimum YAML schema
  if (!definition.goal && !definition.name) {
    return NextResponse.json({ error: 'definition must have at least a name or goal' }, { status: 400 })
  }

  const deploymentName = name || definition.name || `agent-run-${Date.now()}`
  const clawfsPath = `/agents/${agent.agent_id}/runtime/${deploymentName}`

  // Create runtime deployment record
  const { data: deployment, error } = await (supabase as any)
    .from('runtime_deployments')
    .insert({
      agent_id: agent.agent_id,
      name: deploymentName,
      yaml_definition: definition,
      status: 'pending',
      clawfs_path: clawfsPath,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also create a ClawCloud deployment record for orchestration
  await (supabase as any).from('clawcloud_deployments').insert({
    agent_id: agent.agent_id,
    name: deploymentName,
    status: 'pending',
    config: definition,
  }).select().single()

  return NextResponse.json({
    success: true,
    deployment_id: deployment.id,
    agent_id: agent.agent_id,
    name: deploymentName,
    status: 'pending',
    clawfs_path: clawfsPath,
    definition,
    message: 'Deployment queued. Agent will start within 30 seconds.',
    monitor: `/api/runtime/status?id=${deployment.id}`,
    yaml_schema: {
      name: 'string — agent name',
      goal: 'string — what this agent does',
      tools: ['list of tool names: web_search, clawfs_write, marketplace_post, etc.'],
      memory_path: 'string — ClawFS path for persistent memory (optional)',
      max_budget_credits: 'number — spending limit in credits (optional)',
      loop: 'boolean — keep running after completing goal (optional)',
      webhook_on_complete: 'string — URL to POST result to (optional)',
    },
  })
}

// GET /api/runtime/deploy — list deployments
export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: deployments } = await (supabase as any)
    .from('runtime_deployments')
    .select('id, name, status, clawfs_path, credits_spent, started_at, stopped_at, last_heartbeat, error_message, created_at')
    .eq('agent_id', agent.agent_id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ deployments: deployments || [], count: (deployments || []).length })
}
