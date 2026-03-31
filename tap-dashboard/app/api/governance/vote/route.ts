import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'

// Rate limit: 20 votes per minute per IP
const MAX_BODY_SIZE_KB = 50;

export async function POST(request: NextRequest) {
  const path = '/api/governance/vote';
  
  // Apply rate limiting
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const {
      proposal_id,
      vote_type, // 'yes' or 'no'
      // ClawID auth
      voter_public_key,
      voter_signature,
      timestamp,
    } = body
    
    if (!proposal_id || !vote_type || !voter_public_key || !voter_signature) {
      const response = NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    if (vote_type !== 'yes' && vote_type !== 'no') {
      const response = NextResponse.json(
        { error: 'Invalid vote type (must be yes or no)' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Verify ClawID signature
    const payload = { proposal_id, vote_type, timestamp }
    const verification = await verifyClawIDSignature(voter_public_key, voter_signature, payload)
    
    if (!verification.valid) {
      const response = NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Look up voter
    const { data: voter, error: voterError } = await supabase
      .from('agent_registry')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', voter_public_key)
      .single()
    
    if (voterError || !voter) {
      const response = NextResponse.json(
        { error: 'Voter agent not found' },
        { status: 404 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Check proposal exists and is active
    const { data: proposal, error: proposalError } = await supabase
      .from('governance_proposals')
      .select('id, status, ends_at')
      .eq('id', proposal_id)
      .single()
    
    if (proposalError || !proposal) {
      const response = NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    if (proposal.status !== 'active') {
      const response = NextResponse.json(
        { error: 'Proposal is not active' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    if (new Date(proposal.ends_at) < new Date()) {
      const response = NextResponse.json(
        { error: 'Voting window has closed' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Check if already voted
    const { data: existingVote } = await supabase
      .from('governance_votes')
      .select('id')
      .eq('proposal_id', proposal_id)
      .eq('voter_id', voter.agent_id)
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
        const response = NextResponse.json(
          { error: 'Failed to update vote' },
          { status: 500 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
    } else {
      // Create new vote
      const { error: voteError } = await supabase
        .from('governance_votes')
        .insert({
          proposal_id,
          voter_id: voter.agent_id,
          voter_public_key,
          voter_signature,
          vote_type,
          tap_weight: voter.reputation ?? 0,
        })
      
      if (voteError) {
        console.error('Failed to record vote:', voteError)
        const response = NextResponse.json(
          { error: 'Failed to record vote' },
          { status: 500 }
        );
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
    }
    
    const response = NextResponse.json({
      success: true,
      vote: {
        proposal_id,
        vote_type,
        voter: {
          id: voter.agent_id,
          name: voter.name,
          tap_weight: voter.reputation,
        },
      },
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Governance vote error:', error)
    const response = NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
