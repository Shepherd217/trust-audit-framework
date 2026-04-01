/**
 * GET /api/agent/lineage
 *
 * Query the agent lineage tree — parents, children, root.
 *
 * Auth: Bearer token
 *
 * Query params:
 *   ?direction=up|down|both  — up=ancestors, down=descendants, both=full tree (default: both)
 *   ?agent_id=xxx            — query another agent's lineage (public, no auth needed for this)
 *
 * Response:
 * {
 *   agent: { agent_id, name, handle, reputation },
 *   parent: AgentSummary | null,
 *   children: AgentSummary[],
 *   siblings: AgentSummary[],
 *   root: AgentSummary,
 *   lineage: {
 *     depth: number,
 *     total_descendants: number,
 *     total_credits_spawned: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name, handle, reputation, tier, metadata')
    .eq('api_key_hash', hash)
    .single()
  return data || null
}

type AgentSummary = {
  agent_id: string
  name: string
  handle: string
  reputation: number
  tier: string
  platform: string
  lineage_depth: number
  spawned_at: string | null
}

function summarise(a: any): AgentSummary {
  return {
    agent_id:      a.agent_id,
    name:          a.name,
    handle:        a.handle,
    reputation:    a.reputation ?? 0,
    tier:          a.tier ?? 'Bronze',
    platform:      a.platform ?? a.metadata?.platform ?? 'MoltOS',
    lineage_depth: a.metadata?.lineage_depth ?? 0,
    spawned_at:    a.metadata?.spawned_at ?? a.created_at ?? null,
  }
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const direction  = searchParams.get('direction') || 'both'
  const targetId   = searchParams.get('agent_id')

  // Auth — required unless querying by explicit agent_id (public lineage)
  let agentId: string
  if (targetId) {
    agentId = targetId
  } else {
    const agent = await resolveAgent(req)
    if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    agentId = agent.agent_id
  }

  try {
    // Fetch the focal agent
    const { data: focal } = await (sb as any)
      .from('agent_registry')
      .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
      .eq('agent_id', agentId)
      .single()

    if (!focal) return applySecurityHeaders(NextResponse.json({ error: 'Agent not found' }, { status: 404 }))

    const parentId: string | null  = focal.metadata?.parent_id ?? null
    const rootId: string           = focal.metadata?.root_id ?? agentId
    const spawnedChildren: string[] = focal.metadata?.spawned_children ?? []

    // Fetch parent
    let parent: AgentSummary | null = null
    if (parentId && (direction === 'up' || direction === 'both')) {
      const { data: p } = await (sb as any)
        .from('agent_registry')
        .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
        .eq('agent_id', parentId)
        .single()
      if (p) parent = summarise(p)
    }

    // Fetch children
    let children: AgentSummary[] = []
    if (direction === 'down' || direction === 'both') {
      if (spawnedChildren.length > 0) {
        const { data: childRows } = await (sb as any)
          .from('agent_registry')
          .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
          .in('agent_id', spawnedChildren)
        children = (childRows || []).map(summarise)
      }
      // Also query by parent_id in metadata (belt + suspenders)
      const { data: metaChildren } = await (sb as any)
        .from('agent_registry')
        .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
        .contains('metadata', { parent_id: agentId })
        .limit(50)
      const metaChildList = (metaChildren || []).map(summarise)
      // Merge dedup
      const seen = new Set(children.map((c: AgentSummary) => c.agent_id))
      metaChildList.forEach((c: AgentSummary) => { if (!seen.has(c.agent_id)) children.push(c) })
    }

    // Fetch siblings (other children of same parent)
    let siblings: AgentSummary[] = []
    if (parentId && direction === 'both') {
      const { data: sibRows } = await (sb as any)
        .from('agent_registry')
        .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
        .contains('metadata', { parent_id: parentId })
        .neq('agent_id', agentId)
        .limit(20)
      siblings = (sibRows || []).map(summarise)
    }

    // Fetch root
    let root: AgentSummary = summarise(focal)
    if (rootId !== agentId) {
      const { data: rootRow } = await (sb as any)
        .from('agent_registry')
        .select('agent_id, name, handle, reputation, tier, platform, metadata, created_at')
        .eq('agent_id', rootId)
        .single()
      if (rootRow) root = summarise(rootRow)
    }

    return applySecurityHeaders(NextResponse.json({
      agent:    summarise(focal),
      parent,
      children,
      siblings,
      root,
      is_root:  rootId === agentId,
      lineage: {
        depth:                 focal.metadata?.lineage_depth ?? 0,
        parent_id:             parentId,
        root_id:               rootId,
        total_children:        children.length,
        total_spawned_all_time: spawnedChildren.length,
      },
    }))

  } catch (err: any) {
    return applySecurityHeaders(NextResponse.json({ error: err.message }, { status: 500 }))
  }
}
