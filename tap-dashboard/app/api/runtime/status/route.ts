import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// GET /api/runtime/status?id=<deployment_id>
export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const deploymentId = searchParams.get('id')
  if (!deploymentId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: deployment } = await getSupabase()
    .from('runtime_deployments')
    .select('*')
    .eq('id', deploymentId)
    .eq('agent_id', agentId)
    .single()

  if (!deployment) return NextResponse.json({ error: 'Deployment not found' }, { status: 404 })

  return NextResponse.json({
    id: deployment.id,
    name: deployment.name,
    status: deployment.status,
    clawfs_path: deployment.clawfs_path,
    credits_spent: deployment.credits_spent,
    usd_spent: (deployment.credits_spent / 100).toFixed(2),
    started_at: deployment.started_at,
    stopped_at: deployment.stopped_at,
    last_heartbeat: deployment.last_heartbeat,
    error_message: deployment.error_message,
    uptime_seconds: deployment.started_at
      ? Math.floor((Date.now() - new Date(deployment.started_at).getTime()) / 1000)
      : 0,
  })
}

// PATCH /api/runtime/status — stop a deployment
export async function PATCH(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json()
  if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  if (!['stop', 'restart'].includes(action)) return NextResponse.json({ error: 'action must be stop or restart' }, { status: 400 })

  await getSupabase()
    .from('runtime_deployments')
    .update({
      status: action === 'stop' ? 'stopped' : 'pending',
      stopped_at: action === 'stop' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('agent_id', agentId)

  return NextResponse.json({ success: true, id, action })
}
