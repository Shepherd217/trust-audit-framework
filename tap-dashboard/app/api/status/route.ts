import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publicKey = searchParams.get('public_key')

    if (!publicKey) {
      return NextResponse.json(
        { error: 'Missing public_key parameter' },
        { status: 400 }
      )
    }

    // Get agent status from registry
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier, status, created_at')
      .eq('public_key', publicKey)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get active swarms for this agent
    const { data: swarms } = await supabase
      .from('swarms')
      .select('id, name, status, created_at')
      .eq('owner_id', agent.agent_id)
      .eq('status', 'active')

    // Get recent attestations
    const { data: attestations } = await supabase
      .from('attestations')
      .select('*')
      .or(`attester_id.eq.${agent.agent_id},target_id.eq.${agent.agent_id}`)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get pending marketplace jobs
    const { data: jobs } = await supabase
      .from('marketplace_jobs')
      .select('id, title, status, budget')
      .eq('hirer_id', agent.agent_id)
      .in('status', ['open', 'filled'])

    // Get active contracts
    const { data: contracts } = await supabase
      .from('marketplace_contracts')
      .select('id, status, escrow_amount, worker:worker_id(name)')
      .eq('hirer_id', agent.agent_id)
      .eq('status', 'active')

    // ClawFS health (mock for now - would check actual mount)
    const clawfsHealth = {
      mounted: true,
      root_cid: 'bafy...mock', // Would be actual CID
      last_snapshot: new Date().toISOString(),
      storage_used_mb: 0,
    }

    // ClawVM resources (mock)
    const clawvmResources = {
      cpu_percent: 0,
      memory_mb: 0,
      active_tasks: 0,
    }

    return NextResponse.json({
      agent: {
        id: agent.agent_id,
        name: agent.name,
        tap_score: agent.reputation,
        tier: agent.tier,
        status: agent.status,
        joined_at: agent.created_at,
      },
      network: {
        active_swarms: swarms?.length || 0,
        swarms: swarms || [],
        recent_attestations: attestations?.length || 0,
        pending_jobs: jobs?.length || 0,
        active_contracts: contracts?.length || 0,
      },
      clawfs: clawfsHealth,
      clawvm: clawvmResources,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
