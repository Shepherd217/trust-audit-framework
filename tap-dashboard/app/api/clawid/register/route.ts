import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publicKey, agentId } = body
    
    if (!publicKey || !agentId) {
      return NextResponse.json(
        { error: 'Missing publicKey or agentId' },
        { status: 400 }
      )
    }
    
    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', publicKey)
      .single()
    
    if (existing) {
      // Return existing agent
      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('public_key', publicKey)
        .single()
      
      return NextResponse.json({
        success: true,
        agent: {
          agent_id: agent.agent_id,
          name: agent.name,
          public_key: agent.public_key,
          tier: agent.tier,
          reputation: agent.reputation,
          status: agent.status,
        },
      })
    }
    
    // Create new agent with ClawID
    const name = `Agent ${agentId.slice(0, 8)}`
    
    const { data: agent, error } = await supabase
      .from('agents')
      .insert({
        agent_id: agentId,
        name,
        public_key: publicKey,
        tier: 'Bronze',
        reputation: 0,
        status: 'active',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create agent:', error)
      return NextResponse.json(
        { error: 'Failed to register ClawID' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        name: agent.name,
        public_key: agent.public_key,
        tier: agent.tier,
        reputation: agent.reputation,
        status: agent.status,
      },
    })
  } catch (error) {
    console.error('ClawID registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
