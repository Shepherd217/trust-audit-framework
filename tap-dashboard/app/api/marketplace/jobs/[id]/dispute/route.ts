import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { classifyDispute } from '@/lib/classification'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      reason,
      evidence_cid,
      hirer_public_key,
      hirer_signature,
      timestamp,
      challenge,
    } = body

    if (!reason || !hirer_public_key || !hirer_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify hirer's ClawID signature
    const payload = challenge
      ? { path: `/jobs/${id}/dispute`, content_hash: body.content_hash || '', challenge, timestamp }
      : { job_id: id, reason, evidence_cid, timestamp }
    const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Get contract
    const contractResult = await supabase
      .from('marketplace_contracts')
      .select('id, job_id, hirer_id, worker_id, hirer_public_key, worker_public_key, status')
      .eq('job_id', id)
      .eq('hirer_public_key', hirer_public_key)
      .single()

    const contract = contractResult.data

    if (contractResult.error || !contract) {
      return NextResponse.json(
        { error: 'Contract not found or unauthorized' },
        { status: 404 }
      )
    }

    if (contract.status !== 'active') {
      return NextResponse.json(
        { error: 'Can only dispute active contracts' },
        { status: 400 }
      )
    }

    // Create dispute using existing disputes table
    const disputeResult = await supabase
      .from('disputes')
      .insert({
        claimant_id: contract.hirer_id,
        opponent_id: contract.worker_id ?? '',
        claim: reason,
        evidence: evidence_cid || null,
        dispute_status: 'pending',
      })
      .select()
      .single()

    const dispute = disputeResult.data

    if (disputeResult.error || !dispute) {
      console.error('Failed to create dispute:', disputeResult.error)
      return NextResponse.json(
        { error: 'Failed to file dispute' },
        { status: 500 }
      )
    }

    // Update contract status
    await supabase
      .from('marketplace_contracts')
      .update({ status: 'disputed' })
      .eq('id', contract.id)

    // ===== COMMITTEE INTELLIGENCE INTEGRATION =====
    // Auto-classify dispute and select committee
    let classification = null;
    let committee = null;
    
    try {
      // Step 1: Classify complexity
      classification = classifyDispute({
        description: reason,
        evidenceTypes: evidence_cid ? ['ipfs_evidence'] : [],
        stakeholderCount: 2,
        taskSteps: 3,
        hasAutomatedTests: false,
        hasClearAcceptanceCriteria: false
      });
      
      // Step 2: Save classification to database
      const { error: classError } = await supabase
        .from('dispute_complexity_scores')
        .insert({
          dispute_id: dispute.id,
          primary_category: classification.primaryCategory,
          secondary_category: classification.secondaryCategory,
          classification_confidence: classification.classificationConfidence,
          evidence_objectivity: classification.evidenceObjectivity,
          domain_expertise_required: classification.domainExpertiseRequired,
          specification_clarity: classification.specificationClarity,
          stakeholder_count: classification.stakeholderCount || 2,
          task_decomposition_depth: classification.taskDecompositionDepth || 3,
          coordination_complexity: classification.coordinationComplexity,
          difficulty_rating: classification.difficultyRating,
          classification_method: 'auto',
          classified_at: new Date().toISOString()
        });
      
      if (classError) {
        console.error('[Dispute] Failed to save classification:', classError);
      }
      
      // Step 3: Select committee via RPC
      const committeeSize = classification.difficultyRating >= 4 ? 7 : 5;
      const { data: committeeData, error: committeeError } = await supabase.rpc(
        'select_committee',
        {
          p_dispute_id: dispute.id,
          p_committee_size: committeeSize,
          p_target_domain: null
        }
      );
      
      if (committeeError) {
        console.error('[Dispute] Committee selection failed:', committeeError);
      } else if (committeeData && committeeData.length > 0) {
        committee = committeeData;
        
        // Save committee assignments
        const assignments = committee.map((member: any) => ({
          dispute_id: dispute.id,
          round: 1,
          agent_id: member.agent_id,
          selection_method: 'rbts',
          rbts_rank: member.rbts_rank,
          expertise_score_at_selection: member.voting_weight,
          domain_match_score: member.domain_match_score,
          voting_weight: member.voting_weight,
          selected_at: new Date().toISOString()
        }));
        
        const { error: assignError } = await supabase
          .from('committee_assignments')
          .insert(assignments);
        
        if (assignError) {
          console.error('[Dispute] Failed to save committee:', assignError);
        }
      }
    } catch (ciError) {
      // Don't fail the dispute if CI fails - log and continue
      console.error('[Dispute] Committee Intelligence error:', ciError);
    }
    // ===== END COMMITTEE INTELLIGENCE =====

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        status: dispute.dispute_status,
      },
      committee_intelligence: classification ? {
        classified: true,
        difficulty: `${classification.difficultyRating}/5`,
        category: classification.primaryCategory,
        evidence_objectivity: `${Math.round(classification.evidenceObjectivity * 100)}%`,
        committee_size: committee?.length || 0,
        committee_selected: !!committee && committee.length > 0
      } : {
        classified: false,
        error: 'Classification failed - will retry async'
      },
      message: committee?.length > 0 
        ? `Dispute filed. Committee of ${committee.length} selected.` 
        : 'Dispute filed. Committee will be assigned shortly.',
    })
  } catch (error) {
    console.error('Marketplace dispute error:', error)
    return NextResponse.json(
      { error: 'Failed to file dispute' },
      { status: 500 }
    )
  }
}
