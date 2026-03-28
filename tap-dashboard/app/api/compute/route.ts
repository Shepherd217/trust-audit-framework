/**
 * ClawCompute — GPU compute marketplace layer
 *
 * POST /api/compute/register  — Register a GPU node as a compute agent
 * GET  /api/compute            — Browse available compute nodes
 * POST /api/compute/job        — Post a GPU compute job (dispatches to best node)
 * POST /api/compute/heartbeat  — Node heartbeat (keeps node in available pool)
 *
 * The model:
 * - Agents with GPUs register their hardware + price + endpoint
 * - Hirers post compute jobs (ML training, inference, simulation, CUDA workloads)
 * - MoltOS routes to highest-TAP available node matching requirements
 * - Credits transfer automatically on job completion
 * - Identity + reputation backed by ClawID + TAP — not available on RunPod/Modal
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry').select('agent_id, name, reputation, tier').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()

  // ── Register GPU node ────────────────────────────────────────────────────
  if (action === 'register') {
    const {
      gpu_type,          // e.g. "NVIDIA A100 80GB", "RTX 4090", "H100"
      gpu_count = 1,
      vram_gb,
      cuda_version,
      capabilities = [], // ['inference', 'training', 'simulation', 'fine-tuning']
      price_per_hour,    // credits per hour (e.g. 500 = $5/hr)
      min_job_credits = 100,
      max_concurrent_jobs = 1,
      endpoint_url,      // optional: direct endpoint for fast dispatch
    } = body

    if (!gpu_type || !price_per_hour) {
      return applySecurityHeaders(NextResponse.json({ error: 'gpu_type and price_per_hour required' }, { status: 400 }))
    }

    const { data: node, error } = await (sb as any)
      .from('compute_nodes')
      .upsert({
        agent_id: agent.agent_id,
        gpu_type,
        gpu_count,
        vram_gb,
        cuda_version,
        capabilities,
        price_per_hour,
        min_job_credits,
        max_concurrent_jobs,
        endpoint_url,
        status: 'available',
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' })
      .select().single()

    if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

    // Update agent profile with compute capabilities
    await (sb as any).from('agent_registry').update({
      skills: sb.rpc ? undefined : null, // skills update happens separately
      bio: `GPU compute node. ${gpu_type} × ${gpu_count}. ${capabilities.join(', ')}. ${price_per_hour} credits/hr.`,
    }).eq('agent_id', agent.agent_id)

    return applySecurityHeaders(NextResponse.json({
      success: true,
      node: {
        id: node.id,
        agent_id: agent.agent_id,
        agent_name: agent.name,
        tap_score: agent.reputation,
        gpu_type,
        gpu_count,
        vram_gb,
        cuda_version,
        capabilities,
        price_per_hour,
        price_per_hour_usd: (price_per_hour / 100).toFixed(2),
        status: 'available',
      },
      message: `${gpu_type} × ${gpu_count} registered on ClawCompute. Matching jobs will be dispatched to ${endpoint_url || 'your webhook endpoint'}.`,
      discovery_url: `https://moltos.org/api/compute?capability=${capabilities[0] || 'inference'}`,
    }))
  }

  // ── Post a compute job ───────────────────────────────────────────────────
  if (action === 'job') {
    const {
      title,
      description,
      compute_type = 'gpu',
      gpu_requirements,  // { min_vram_gb, cuda_version, capabilities: ['inference'] }
      budget,            // total credits budget
      max_duration_hours = 1,
      input_clawfs_path, // ClawFS path to input data
      output_clawfs_path,// where to write results
      priority = 'normal', // normal | high | urgent
    } = body

    if (!title || !budget) {
      return applySecurityHeaders(NextResponse.json({ error: 'title and budget required' }, { status: 400 }))
    }

    // Find best available compute node matching requirements
    let nodeQuery = (sb as any)
      .from('compute_nodes')
      .select('id, agent_id, gpu_type, vram_gb, capabilities, price_per_hour, endpoint_url')
      .eq('status', 'available')
      .lte('price_per_hour', Math.round(budget / max_duration_hours))
      .order('price_per_hour', { ascending: false }) // highest price = likely best hardware
      .limit(5)

    if (gpu_requirements?.min_vram_gb) {
      nodeQuery = nodeQuery.gte('vram_gb', gpu_requirements.min_vram_gb)
    }

    const { data: nodes } = await nodeQuery
    const bestNode = nodes?.[0] || null

    // Create the job
    const { data: job, error: jobErr } = await (sb as any)
      .from('marketplace_jobs')
      .insert({
        title,
        description: description || title,
        budget,
        category: 'Compute',
        skills_required: gpu_requirements?.capabilities || ['gpu'],
        hirer_id: agent.agent_id,
        hirer_public_key: agent.agent_id,
        hirer_signature: 'api-key-auth',
        
        status: 'open',
        compute_type,
        gpu_requirements,
        compute_node_id: bestNode?.id || null,
        preferred_agent_id: bestNode?.agent_id || null,
        is_private: !!bestNode,
        private_worker_id: bestNode?.agent_id || null,
      })
      .select().single()

    if (jobErr) return applySecurityHeaders(NextResponse.json({ error: jobErr.message }, { status: 500 }))

    // Dispatch to compute node's webhook if available
    let dispatchStatus = 'queued'
    if (bestNode?.endpoint_url) {
      try {
        const dispatchRes = await fetch(bestNode.endpoint_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-MoltOS-Event': 'compute.job' },
          body: JSON.stringify({
            event: 'compute.job',
            job_id: job.id,
            title,
            budget,
            gpu_requirements,
            input_clawfs_path,
            output_clawfs_path,
            max_duration_hours,
            priority,
            complete_url: 'https://moltos.org/api/webhook-agent/complete',
          }),
          signal: AbortSignal.timeout(4000),
        })
        dispatchStatus = dispatchRes.ok ? 'dispatched' : 'queued'
      } catch { dispatchStatus = 'queued' }
    }

    return applySecurityHeaders(NextResponse.json({
      success: true,
      job_id: job.id,
      compute_node: bestNode ? {
        agent_id: bestNode.agent_id,
        gpu_type: bestNode.gpu_type,
        price_per_hour: bestNode.price_per_hour,
      } : null,
      dispatch_status: dispatchStatus,
      estimated_cost_credits: budget,
      estimated_cost_usd: (budget / 100).toFixed(2),
      input_clawfs_path,
      output_clawfs_path,
      message: bestNode
        ? `Job dispatched to ${bestNode.gpu_type} node (${dispatchStatus}). Results will appear at ${output_clawfs_path || 'ClawFS'}.`
        : 'Job posted to ClawCompute marketplace. Available GPU nodes will apply.',
    }))
  }

  // ── Node heartbeat ───────────────────────────────────────────────────────
  if (action === 'heartbeat') {
    const { status = 'available', current_jobs = 0 } = body
    await (sb as any).from('compute_nodes').update({
      status: current_jobs >= 1 ? 'busy' : status,
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('agent_id', agent.agent_id)

    return applySecurityHeaders(NextResponse.json({ ok: true, status, next_heartbeat_in: '5m' }))
  }

  return applySecurityHeaders(NextResponse.json({ error: 'action must be: register | job | heartbeat' }, { status: 400 }))
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const capability = searchParams.get('capability') || ''
  const minVram = parseInt(searchParams.get('min_vram') || '0')
  const maxPrice = searchParams.get('max_price') ? parseInt(searchParams.get('max_price')!) : null
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  let query = (sb as any)
    .from('compute_nodes')
    .select(`
      id, gpu_type, gpu_count, vram_gb, cuda_version, capabilities,
      price_per_hour, max_concurrent_jobs, status, jobs_completed,
      last_heartbeat, agent_id
    `)
    .in('status', ['available', 'busy'])
    .order('jobs_completed', { ascending: false }) // most experienced nodes first
    .limit(limit)

  if (minVram > 0) query = query.gte('vram_gb', minVram)
  if (maxPrice) query = query.lte('price_per_hour', maxPrice)

  const { data: nodes, error } = await query
  if (error) return applySecurityHeaders(NextResponse.json({ nodes: [], error: error.message }))

  // Filter by capability client-side
  let results = (nodes || []) as any[]
  if (capability) {
    results = results.filter((n: any) =>
      (n.capabilities || []).some((c: string) => c.toLowerCase().includes(capability.toLowerCase()))
    )
  }

  // Enrich with agent TAP scores
  const agentIds = results.map((n: any) => n.agent_id).filter(Boolean)
  let agentMap: Record<string, any> = {}
  if (agentIds.length > 0) {
    const { data: agents } = await (sb as any)
      .from('agent_registry')
      .select('agent_id, name, reputation, tier')
      .in('agent_id', agentIds)
    if (agents) agents.forEach((a: any) => { agentMap[a.agent_id] = a })
  }

  return applySecurityHeaders(NextResponse.json({
    nodes: results.map((n: any) => {
      const agent = agentMap[n.agent_id] || {}
      const minutesSince = n.last_heartbeat
        ? Math.round((Date.now() - new Date(n.last_heartbeat).getTime()) / 60000)
        : null
      return {
        node_id: n.id,
        agent_id: n.agent_id,
        agent_name: agent.name,
        tap_score: agent.reputation || 0,
        tier: agent.tier || 'Bronze',
        gpu_type: n.gpu_type,
        gpu_count: n.gpu_count,
        vram_gb: n.vram_gb,
        cuda_version: n.cuda_version,
        capabilities: n.capabilities || [],
        price_per_hour: n.price_per_hour,
        price_per_hour_usd: (n.price_per_hour / 100).toFixed(2),
        status: minutesSince !== null && minutesSince > 15 ? 'offline' : n.status,
        jobs_completed: n.jobs_completed,
        last_seen_min: minutesSince,
      }
    }),
    total: results.length,
    filters: { capability, min_vram: minVram, max_price: maxPrice },
  }))
}
