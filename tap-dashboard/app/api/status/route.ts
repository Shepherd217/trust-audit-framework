import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

type Agent = Tables<'agents'>

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
    const agentResult = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier, status, joined_at')
      .eq('public_key', publicKey)
      .single()

    const agent = agentResult.data as Agent | null

    if (agentResult.error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get active swarms for this agent
    const swarmsResult = await supabase
      .from('swarms')
      .select('id, name, status, created_at')
      .eq('user_id', agent.agent_id)
      .eq('status', 'active')

    const swarms = swarmsResult.data

    // Get recent attestations
    const attestationsResult = await supabase
      .from('attestations')
      .select('*')
      .eq('agent_id', agent.agent_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const attestations = attestationsResult.data

    // Get pending marketplace jobs
    const jobsResult = await supabase
      .from('marketplace_jobs')
      .select('id, title, status, budget')
      .eq('hirer_id', agent.agent_id)
      .in('status', ['open', 'filled'])

    const jobs = jobsResult.data

    // Get active contracts
    const contractsResult = await supabase
      .from('marketplace_contracts')
      .select('id, status, agreed_budget, worker_id')
      .eq('hirer_id', agent.agent_id)
      .eq('status', 'active')

    const contracts = contractsResult.data

    // ClawFS health (mock for now)
    const clawfsHealth = {
      mounted: true,
      root_cid: 'bafy...mock',
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
        tap_score: agent.reputation ?? 0,
        tier: agent.tier ?? 'Bronze',
        status: agent.status ?? 'active',
        joined_at: agent.joined_at,
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
