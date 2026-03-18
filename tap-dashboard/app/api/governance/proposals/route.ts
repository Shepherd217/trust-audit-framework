import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Type definitions
interface Proposal {
  id: string
  title: string
  description: string
  parameter: string | null
  new_value: string | null
  evidence_cid: string | null
  status: string
  ends_at: string
  created_at: string
  proposer_id: string
  proposer_public_key: string
  proposer_signature: string
  proposer?: {
    agent_id: string
    name: string
    reputation: number
    tier: string
  }
}

interface Vote {
  vote_type: 'yes' | 'no'
  voter: {
    reputation: number
  } | null
}

interface Agent {
  agent_id: string
  name: string
  reputation: number
  tier: string
}

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
  return signature.length > 0 && publicKey.length > 0
}

// GET /api/governance/proposals - List all proposals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    
    const result = await supabase
      .from('governance_proposals')
      .select(`
        *,
        proposer:proposer_id(agent_id, name, reputation, tier)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
    
    const proposals: Proposal[] = result.data || []
    const error = result.error
    
    if (error) {
      console.error('Failed to fetch proposals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch proposals' },
        { status: 500 }
      )
    }
    
    // Calculate vote tallies
    const proposalsWithVotes = await Promise.all(
      proposals.map(async (p) => {
        const voteResult = await supabase
          .from('governance_votes')
          .select('vote_type, voter: voter_id(reputation)')
          .eq('proposal_id', p.id)
        
        const votes: Vote[] = voteResult.data || []
        
        const yesVotes = votes.filter(v => v.vote_type === 'yes').reduce((s, v) => s + (v.voter?.reputation || 0), 0)
        const noVotes = votes.filter(v => v.vote_type === 'no').reduce((s, v) => s + (v.voter?.reputation || 0), 0)
        const totalVotes = yesVotes + noVotes
        
        // Calculate time remaining
        const endTime = new Date(p.ends_at).getTime()
        const now = Date.now()
        const timeRemaining = Math.max(0, endTime - now)
        
        return {
          ...p,
          votes: {
            yes: yesVotes,
            no: noVotes,
            total: totalVotes,
            yes_percent: totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0,
            turnout: totalVotes,
          },
          time_remaining: timeRemaining,
          has_ended: timeRemaining === 0,
        }
      })
    )
    
    return NextResponse.json({
      proposals: proposalsWithVotes,
      count: proposalsWithVotes.length,
    })
  } catch (error) {
    console.error('Governance list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}

// POST /api/governance/proposals - Create new proposal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      parameter,
      new_value,
      evidence_cid,
      // ClawID auth
      proposer_public_key,
      proposer_signature,
      timestamp,
    } = body
    
    if (!title || !description || !proposer_public_key || !proposer_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Verify ClawID signature
    const payload = { title, description, parameter, new_value, timestamp }
    const isValid = await verifyClawIDSignature(proposer_public_key, proposer_signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }
    
    // Look up proposer
    const proposerResult = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', proposer_public_key)
      .single()
    
    const proposer: Agent | null = proposerResult.data
    const proposerError = proposerResult.error
    
    if (proposerError || !proposer) {
      return NextResponse.json(
        { error: 'Proposer agent not found' },
        { status: 404 }
      )
    }
    
    // Check TAP requirement (≥ 70 to propose)
    if (proposer.reputation < 70) {
      return NextResponse.json(
        { error: 'Insufficient TAP score to create proposal (minimum 70)' },
        { status: 403 }
      )
    }
    
    // Calculate dynamic voting window (base 24h)
    const baseWindow = 24 * 60 * 60 * 1000
    const endsAt = new Date(Date.now() + baseWindow).toISOString()
    
    // Create proposal
    const proposalResult = await supabase
      .from('governance_proposals')
      .insert({
        title,
        description,
        parameter: parameter || null,
        new_value: new_value || null,
        evidence_cid: evidence_cid || null,
        proposer_id: proposer.agent_id,
        proposer_public_key,
        proposer_signature,
        status: 'active',
        ends_at: endsAt,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    const proposal: Proposal | null = proposalResult.data
    const error = proposalResult.error
    
    if (error || !proposal) {
      console.error('Failed to create proposal:', error)
      return NextResponse.json(
        { error: 'Failed to create proposal' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        ends_at: proposal.ends_at,
        proposer: {
          id: proposer.agent_id,
          name: proposer.name,
          reputation: proposer.reputation,
        },
      },
    })
  } catch (error) {
    console.error('Governance create error:', error)
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    )
  }
}
