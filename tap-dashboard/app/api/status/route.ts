import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // Get agent status from user_agents table (not 'agents')
    const agentResult = await supabase
      .from('agents')
      .select('id, name, reputation_score, tier, status, created_at')
      .eq('public_key', publicKey)
      .single()

    const agent = agentResult.data

    if (agentResult.error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get recent attestations
    const attestationsResult = await supabase
      .from('attestations')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const attestations = attestationsResult.data

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        tap_score: agent.reputation_score ?? 0,
        tier: agent.tier ?? 'Bronze',
        status: agent.status ?? 'active',
        joined_at: agent.created_at,
      },
      attestations: attestations || [],
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
