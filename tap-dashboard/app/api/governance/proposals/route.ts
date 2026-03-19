import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Proposal = Tables<'governance_proposals'>
type Agent = Tables<'agents'>

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
    
    const proposals = (result.data || []) as (Proposal & { proposer: { agent_id: string; name: string | null; reputation: number | null; tier: string | null } | null })[]
    
    if (result.error) {
      console.error('Failed to fetch proposals:', result.error)
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
        
        const votes = (voteResult.data || []) as { vote_type: string; voter: { reputation: number | null } | null }[]
        
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
    const verification = await verifyClawIDSignature(proposer_public_key, proposer_signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }
    
    // Look up proposer
    const proposerResult = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', proposer_public_key)
      .single()
    
    const proposer = proposerResult.data as Agent | null
    
    if (proposerResult.error || !proposer) {
      return NextResponse.json(
        { error: 'Proposer agent not found' },
        { status: 404 }
      )
    }
    
    // Check TAP requirement (≥ 70 to propose)
    if ((proposer.reputation || 0) < 70) {
      return NextResponse.json(
        { error: 'Insufficient TAP score to create proposal (minimum 70)' },
        { status: 403 }
      )
    }
    
    // Calculate dynamic voting window (base 24h)
    const baseWindow = 24 * 60 * 60 * 1000
    const endsAt = new Date(Date.now() + baseWindow).toISOString()
    
    // Create proposal
    const insertData: TablesInsert<'governance_proposals'> = {
      title,
      description,
      parameter: parameter || null,
      new_value: new_value || null,
      evidence_cid: evidence_cid || null,
      proposer_id: proposer.id,
      proposer_public_key,
      proposer_signature,
      status: 'active',
      ends_at: endsAt,
    }
    
    const proposalResult = await supabase
      .from('governance_proposals')
      .insert(insertData)
      .select()
      .single()
    
    const proposal = proposalResult.data as Proposal | null
    
    if (proposalResult.error || !proposal) {
      console.error('Failed to create proposal:', proposalResult.error)
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
          id: proposer.id,
          name: proposer.name || 'Unknown',
          reputation: proposer.reputation || 0,
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
