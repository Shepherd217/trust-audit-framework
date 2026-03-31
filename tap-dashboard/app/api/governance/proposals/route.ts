import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Proposal = Tables<'governance_proposals'>
type Agent = Tables<'agent_registry'>

// Rate limits: GET 30/min, POST 5/min
const MAX_BODY_SIZE_KB = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;
const MIN_TAP_TO_PROPOSE = 70;

// GET /api/governance/proposals - List all proposals
export async function GET(request: NextRequest) {
  const path = '/api/governance/proposals';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    
    // Validate status parameter
    const validStatuses = ['active', 'passed', 'rejected', 'executed'];
    if (!validStatuses.includes(status)) {
      const response = NextResponse.json(
        { error: 'Invalid status. Use: ' + validStatuses.join(', ') },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const result = await supabase
      .from('governance_proposals')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
    
    const proposals = (result.data || []) as Proposal[]
    
    if (result.error) {
      console.error('Failed to fetch proposals:', result.error)
      const response = NextResponse.json(
        { error: 'Failed to fetch proposals' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Enrich proposals with proposer info from agent_registry
    const proposerIds = [...new Set(proposals.map(p => p.proposer_id).filter(Boolean))]
    const { data: proposerAgents } = await supabase
      .from('agent_registry')
      .select('agent_id, name, reputation, tier')
      .in('agent_id', proposerIds)
    const proposerMap: Record<string, { id: string; name: string; reputation: number; tier: string }> = {}
    ;(proposerAgents || []).forEach(a => {
      proposerMap[a.agent_id] = { id: a.agent_id, name: a.name || 'Unknown', reputation: a.reputation || 0, tier: a.tier || 'bronze' }
    })

    // Fetch all votes in a single query (avoid N+1)
    const proposalIds = proposals.map(p => p.id);
    const { data: allVotes, error: votesError } = await supabase
      .from('governance_votes')
      .select('proposal_id, vote_type, tap_weight, voter_id')
      .in('proposal_id', proposalIds);
    
    if (votesError) {
      console.error('Failed to fetch votes:', votesError);
      // Continue with empty votes rather than failing the entire request
    }
    
    // Group votes by proposal_id for efficient lookup
    const votesByProposal: Record<string, any[]> = {};
    (allVotes || []).forEach(vote => {
      const pid = vote.proposal_id as string;
      if (!votesByProposal[pid]) votesByProposal[pid] = [];
      votesByProposal[pid].push(vote as any);
    });
    
    // Calculate vote tallies for each proposal
    const proposalsWithVotes = proposals.map((p) => {
      const votes = votesByProposal[p.id] || [];
      
      const yesVotes = votes.filter((v: any) => v.vote_type === 'yes').reduce((s: number, v: any) => s + (v.tap_weight || 0), 0)
      const noVotes = votes.filter((v: any) => v.vote_type === 'no').reduce((s: number, v: any) => s + (v.tap_weight || 0), 0)
      const totalVotes = yesVotes + noVotes
      
      const endTime = new Date(p.ends_at).getTime()
      const now = Date.now()
      const timeRemaining = Math.max(0, endTime - now)
      
      return {
        ...p,
        proposer: proposerMap[p.proposer_id] || { id: p.proposer_id, name: 'Unknown', reputation: 0, tier: 'bronze' },
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
    
    const response = NextResponse.json({
      proposals: proposalsWithVotes,
      count: proposalsWithVotes.length,
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Governance list error:', error)
    const response = NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

// POST /api/governance/proposals - Create new proposal
export async function POST(request: NextRequest) {
  const path = '/api/governance/proposals';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
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
      const response = NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate title length
    if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH || title.length < 5) {
      const response = NextResponse.json(
        { error: `Title must be 5-${MAX_TITLE_LENGTH} characters` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate description length
    if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH || description.length < 20) {
      const response = NextResponse.json(
        { error: `Description must be 20-${MAX_DESCRIPTION_LENGTH} characters` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate evidence_cid format if provided
    if (evidence_cid && !/^bafy[a-zA-Z0-9]{44,}$/.test(evidence_cid)) {
      const response = NextResponse.json(
        { error: 'Invalid evidence_cid format' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Verify ClawID signature
    const payload = { title, description, parameter, new_value, timestamp }
    const verification = await verifyClawIDSignature(proposer_public_key, proposer_signature, payload)
    
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
    
    // Look up proposer
    const proposerResult = await supabase
      .from('agent_registry')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', proposer_public_key)
      .single()
    
    const proposer = proposerResult.data as Agent | null
    
    if (proposerResult.error || !proposer) {
      const response = NextResponse.json(
        { error: 'Proposer agent not found' },
        { status: 404 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Check TAP requirement
    if ((proposer.reputation || 0) < MIN_TAP_TO_PROPOSE) {
      const response = NextResponse.json(
        { error: `Insufficient MOLT score to create proposal (minimum ${MIN_TAP_TO_PROPOSE})` },
        { status: 403 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
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
      proposer_id: proposer.agent_id,
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
      const response = NextResponse.json(
        { error: 'Failed to create proposal' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const response = NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        ends_at: proposal.ends_at,
        proposer: {
          id: proposer.agent_id,
          name: proposer.name || 'Unknown',
          reputation: proposer.reputation || 0,
        },
      },
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Governance create error:', error)
    const response = NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
