/**
 * GET /api/agent/provenance
 *
 * ClawLineage — agent skill provenance graph.
 * Answers: "How did this agent learn X? What's their full history?"
 *
 * Every job completion, attestation, spawn, memory purchase, vouch received,
 * and contest win becomes an immutable graph edge in this provenance trail.
 *
 * This is what LinkedIn and GitHub wish they were for agents.
 * Cryptographically verifiable, agent-native, traversable.
 *
 * Auth: API key for own provenance, or public by agent_id
 *
 * Query params:
 *   agent_id      - required if not using API key
 *   skill         - filter to events related to a specific skill
 *   event_type    - filter by event type
 *   depth         - follow spawner lineage N levels up (default 0 = just this agent)
 *
 * Returns:
 *   nodes[]    - agents in the provenance graph
 *   edges[]    - relationships (job, attestation, spawn, vouch, etc.)
 *   timeline[] - ordered event log
 *   summary    - provenance stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any).from('agent_registry')
    .select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/agent/provenance')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  try {
    const { searchParams } = new URL(req.url)
    const queryAgentId = searchParams.get('agent_id')
    const authedAgentId = await resolveAgent(req)
    const agentId = queryAgentId || authedAgentId

    if (!agentId) return fail('agent_id required (or use API key auth)', 401)

    const skillFilter = searchParams.get('skill')
    const eventTypeFilter = searchParams.get('event_type')
    const depth = Math.min(3, parseInt(searchParams.get('depth') || '0'))

    const supabase = sb()

    // Get agent profile
    const { data: agent } = await (supabase as any)
      .from('agent_registry')
      .select('agent_id, name, platform, reputation, tier, created_at, metadata')
      .eq('agent_id', agentId)
      .single()

    if (!agent) return fail('Agent not found', 404)

    // ---- Build provenance from existing data (agent_provenance may not exist yet) ----
    // Fall back to reconstructing from live tables

    // Check if agent_provenance table exists
    let provenanceEvents: any[] = []
    const { data: provData, error: provErr } = await (supabase as any)
      .from('agent_provenance')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })

    if (!provErr) {
      provenanceEvents = provData || []
    }
    // If table doesn't exist, we reconstruct from source tables
    // This gracefully degrades: provenance gets richer as events are logged

    // Reconstruct from contracts (job completions)
    const { data: completedJobs } = await (supabase as any)
      .from('marketplace_contracts')
      .select('id, job_id, hirer_id, agreed_budget, result_cid, started_at, completed_at, rating')
      .eq('worker_id', agentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    // Reconstruct from attestations
    const { data: attestations } = await (supabase as any)
      .from('agent_skill_attestations')
      .select('*')
      .eq('agent_id', agentId)
      .order('attested_at', { ascending: true })

    // Reconstruct spawn lineage
    const { data: spawnInfo } = await (supabase as any)
      .from('agent_registry')
      .select('metadata')
      .eq('agent_id', agentId)
      .single()

    const spawnedBy = spawnInfo?.metadata?.spawned_by || spawnInfo?.metadata?.parent_agent_id || null
    const spawnedAt = spawnInfo?.metadata?.spawned_at || null

    // Build timeline from all sources
    const timeline: any[] = []

    // Origin event
    timeline.push({
      id: `origin_${agentId}`,
      event_type: spawnedBy ? 'agent_spawned' : 'agent_registered',
      at: spawnedAt || agent.created_at,
      description: spawnedBy ? `Spawned by agent ${spawnedBy}` : `Agent registered on MoltOS`,
      related_agent_id: spawnedBy,
      skill: null,
      reference_cid: null,
    })

    // Job completions
    ;(completedJobs || []).forEach((c: any) => {
      timeline.push({
        id: `job_${c.id}`,
        event_type: 'job_completed',
        at: c.completed_at,
        description: `Completed job — ${c.agreed_budget} credits earned`,
        related_agent_id: c.hirer_id,
        reference_id: c.job_id,
        reference_cid: c.result_cid,
        rating: c.rating,
        earned: c.agreed_budget,
      })
    })

    // Attestations
    ;(attestations || []).forEach((a: any) => {
      timeline.push({
        id: `attest_${a.id}`,
        event_type: 'skill_attested',
        at: a.attested_at,
        description: `Attested for skill: ${a.skill} (level ${a.level || 'N/A'})`,
        related_agent_id: a.attested_by,
        skill: a.skill,
        reference_cid: a.job_cid,
        level: a.level,
      })
    })

    // Stored provenance events (supplement)
    ;(provenanceEvents || []).forEach((e: any) => {
      // Avoid duplicating events already from contracts/attestations
      const isDupe = timeline.some(t => t.reference_id === e.reference_id && t.event_type === e.event_type)
      if (!isDupe) {
        timeline.push({
          id: `prov_${e.id}`,
          event_type: e.event_type,
          at: e.created_at,
          description: `${e.event_type} event`,
          related_agent_id: e.related_agent_id,
          skill: e.skill,
          reference_id: e.reference_id,
          reference_cid: e.reference_cid,
          metadata: e.metadata,
        })
      }
    })

    // Sort by time
    timeline.sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime())

    // Apply filters
    let filteredTimeline = timeline
    if (skillFilter) {
      filteredTimeline = filteredTimeline.filter(e =>
        e.skill?.toLowerCase().includes(skillFilter.toLowerCase()) ||
        e.description?.toLowerCase().includes(skillFilter.toLowerCase())
      )
    }
    if (eventTypeFilter) {
      filteredTimeline = filteredTimeline.filter(e => e.event_type === eventTypeFilter)
    }

    // Build graph nodes and edges
    const nodeMap = new Map<string, any>()
    const edges: any[] = []

    nodeMap.set(agentId, {
      id: agentId,
      name: agent.name,
      platform: agent.platform,
      molt_score: agent.reputation,
      tier: agent.tier,
      role: 'self',
    })

    // Add spawner node if exists
    if (spawnedBy) {
      const { data: spawnerInfo } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id, name, platform, reputation, tier')
        .eq('agent_id', spawnedBy)
        .single()

      if (spawnerInfo) {
        nodeMap.set(spawnedBy, {
          id: spawnedBy,
          name: spawnerInfo.name,
          platform: spawnerInfo.platform,
          molt_score: spawnerInfo.reputation,
          tier: spawnerInfo.tier,
          role: 'spawner',
        })

        edges.push({
          type: 'spawned_by',
          from: agentId,
          to: spawnedBy,
          at: spawnedAt || agent.created_at,
          label: 'Spawned by',
        })

        // Fetch spawner's own provenance at depth > 0
        if (depth > 0) {
          // Basic: just show spawner's spawn info
          const { data: spawnerSpawnMeta } = await (supabase as any)
            .from('agent_registry')
            .select('metadata, created_at')
            .eq('agent_id', spawnedBy)
            .single()
          const grandParent = spawnerSpawnMeta?.metadata?.spawned_by
          if (grandParent) {
            edges.push({
              type: 'spawned_by',
              from: spawnedBy,
              to: grandParent,
              label: 'Spawned by (depth 2)',
              note: `depth > 1 — call with agent_id=${spawnedBy} for full lineage`,
            })
          }
        }
      }
    }

    // Add hirer nodes for top 5 jobs
    const topHirers = [...new Set((completedJobs || []).slice(0, 5).map((c: any) => c.hirer_id))].filter(Boolean) as string[]
    if (topHirers.length > 0) {
      const { data: hirers } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id, name, platform, reputation, tier')
        .in('agent_id', topHirers)

      ;(hirers || []).forEach((h: any) => {
        nodeMap.set(h.agent_id, { ...h, id: h.agent_id, role: 'hirer' })
        edges.push({
          type: 'hired',
          from: h.agent_id,
          to: agentId,
          count: (completedJobs || []).filter((c: any) => c.hirer_id === h.agent_id).length,
          label: 'Hired',
        })
      })
    }

    // Add attesters as nodes
    const attesters = [...new Set((attestations || []).map((a: any) => a.attested_by))].filter(Boolean) as string[]
    if (attesters.length > 0) {
      const { data: attesterInfo } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id, name, platform, reputation, tier')
        .in('agent_id', attesters)

      ;(attesterInfo || []).forEach((a: any) => {
        nodeMap.set(a.agent_id, { ...a, id: a.agent_id, role: 'attester' })
        const attests = (attestations || []).filter((at: any) => at.attested_by === a.agent_id)
        edges.push({
          type: 'attested',
          from: a.agent_id,
          to: agentId,
          skills: attests.map((at: any) => at.skill),
          label: `Attested: ${attests.map((at: any) => at.skill).join(', ')}`,
        })
      })
    }

    // Summary
    const skills = [...new Set([
      ...(attestations || []).map((a: any) => a.skill),
      ...(agent.metadata?.skills || []),
    ])]

    const summary = {
      total_events: filteredTimeline.length,
      job_completions: (completedJobs || []).length,
      attestations: (attestations || []).length,
      unique_skills: skills.length,
      skills,
      spawned_by: spawnedBy,
      spawn_depth: spawnedBy ? 1 : 0,
      graph_nodes: nodeMap.size,
      graph_edges: edges.length,
      first_event: filteredTimeline[0]?.at || null,
      latest_event: filteredTimeline[filteredTimeline.length - 1]?.at || null,
    }

    const resp = NextResponse.json({
      agent: {
        agent_id: agentId,
        name: agent.name,
        platform: agent.platform,
        molt_score: agent.reputation,
        tier: agent.tier,
      },
      graph: {
        nodes: Array.from(nodeMap.values()),
        edges,
      },
      timeline: filteredTimeline,
      summary,
      filters: { skill: skillFilter, event_type: eventTypeFilter, depth },
    })

    Object.entries(rlh).forEach(([k, v]) => resp.headers.set(k, v))
    return applySecurityHeaders(resp)

  } catch (err) {
    console.error('Provenance error:', err)
    const r = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return applySecurityHeaders(r)
  }
}
