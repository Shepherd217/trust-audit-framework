import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      proposal_id,
      vote_type, // 'yes' or 'no'
      // ClawID auth
      voter_public_key,
      voter_signature,
      timestamp,
    } = body
    
    if (!proposal_id || !vote_type || !voter_public_key || !voter_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    if (vote_type !== 'yes' && vote_type !== 'no') {
      return NextResponse.json(
        { error: 'Invalid vote type (must be yes or no)' },
        { status: 400 }
      )
    }
    
    // Verify ClawID signature
    const payload = { proposal_id, vote_type, timestamp }
    const verification = await verifyClawIDSignature(voter_public_key, voter_signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }
    
    // Look up voter
    const { data: voter, error: voterError } = await supabase
      .from('user_agents')
      .select('id, name, reputation, tier')
      .eq('public_key', voter_public_key)
      .single()
    
    if (voterError || !voter) {
      return NextResponse.json(
        { error: 'Voter agent not found' },
        { status: 404 }
      )
    }
    
    // Check proposal exists and is active
    const { data: proposal, error: proposalError } = await supabase
      .from('governance_proposals')
      .select('id, status, ends_at')
      .eq('id', proposal_id)
      .single()
    
    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }
    
    if (proposal.status !== 'active') {
      return NextResponse.json(
        { error: 'Proposal is not active' },
        { status: 400 }
      )
    }
    
    if (new Date(proposal.ends_at) < new Date()) {
      return NextResponse.json(
        { error: 'Voting window has closed' },
        { status: 400 }
      )
    }
    
    // Check if already voted
    const { data: existingVote } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('proposal_id', proposal_id)
      .eq('voter_id', voter.id)
      .single()
    
    if (existingVote) {
      // Update vote
      const { error: updateError } = await supabase
        .from('governance_votes')
        .update({
          vote_type,
          voter_signature,
          voted_at: new Date().toISOString(),
        })
        .eq('id', existingVote.id)
      
      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update vote' },
          { status: 500 }
        )
      }
    } else {
      // Create new vote
      const { error: voteError } = await supabase
        .from('governance_votes')
        .insert({
          proposal_id,
          voter_id: voter.id,
          voter_public_key,
          voter_signature,
          vote_type,
          tap_weight: voter.reputation ?? 0,
        })
      
      if (voteError) {
        console.error('Failed to record vote:', voteError)
        return NextResponse.json(
          { error: 'Failed to record vote' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      vote: {
        proposal_id,
        vote_type,
        voter: {
          id: voter.id,
          name: voter.name,
          tap_weight: voter.reputation,
        },
      },
    })
  } catch (error) {
    console.error('Governance vote error:', error)
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    )
  }
}
