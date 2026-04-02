export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { classifyDispute, saveClassification } from '@/lib/classification';
import { taskCategory, expertiseDomain, committeeTier } from '@/types/committee-intelligence';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

/**
 * POST /api/arbitra/disputes/[id]/classify
 * Auto-classifies dispute complexity and selects optimal committee
 * 
 * Addresses task difficulty bias identified by agent_anthropo:
 * - Complex tasks (low evidence objectivity) get expert-heavy committees
 * - Simple tasks get generalist committees
 * - RBTS-weighted selection ensures quality
 */

const classifySchema = z.object({
  description: z.string().min(10),
  evidence_types: z.array(z.string()).default([]),
  stakeholder_count: z.number().min(1).max(20).default(2),
  task_steps: z.number().min(1).max(50).default(3),
  has_automated_tests: z.boolean().default(false),
  has_clear_acceptance_criteria: z.boolean().default(false),
  value_at_stake_usd: z.number().optional(),
  time_pressure_hours: z.number().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const disputeId = params.id;
    const body = await request.json();
    const input = classifySchema.parse(body);
    
    // Initialize Supabase
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Step 1: Auto-classify complexity
    console.error(`[Classify] Dispute ${disputeId}: classifying...`);
    const classification = classifyDispute({
      description: input.description,
      evidenceTypes: input.evidence_types,
      stakeholderCount: input.stakeholder_count,
      taskSteps: input.task_steps,
      hasAutomatedTests: input.has_automated_tests,
      hasClearAcceptanceCriteria: input.has_clear_acceptance_criteria
    });
    
    // Step 2: Save classification
    await saveClassification(supabase, disputeId, classification);
    console.error(`[Classify] Dispute ${disputeId}: classified as ${classification.primaryCategory}, difficulty ${classification.difficultyRating}/5`);
    
    // Step 3: Select committee based on complexity
    console.error(`[Classify] Dispute ${disputeId}: selecting committee...`);
    const committeeSize = classification.difficultyRating >= 4 ? 7 : 5; // Complex = larger committee
    
    const { data: committee, error: committeeError } = await supabase.rpc(
      'select_committee', {
        p_dispute_id: disputeId,
        p_committee_size: committeeSize,
        p_target_domain: null // Auto-detect from classification
      } as any);
    
    if (committeeError) {
      console.error('[Classify] Committee selection failed:', committeeError);
      // Don't fail the request, just return classification
      return NextResponse.json({
        success: true,
        classification,
        committee: null,
        error: 'Committee selection pending (insufficient experts)'
      });
    }
    
    // Step 4: Save committee assignments
    if (committee && committee.length > 0) {
      const assignments = committee.map((member: any, index: number) => ({
        dispute_id: disputeId,
        round: 1,
        agent_id: member.agent_id,
        selection_method: 'rbts',
        rbts_rank: member.rbts_rank,
        expertise_score_at_selection: member.voting_weight, // composite score
        domain_match_score: member.domain_match_score,
        voting_weight: member.voting_weight,
        selected_at: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('committee_assignments')
        .insert(assignments);
      
      if (insertError) {
        console.error('[Classify] Failed to save committee:', insertError);
      } else {
        console.error(`[Classify] Dispute ${disputeId}: committee of ${committee.length} selected`);
      }
    }
    
    return NextResponse.json({
      success: true,
      classification,
      committee: committee || [],
      summary: {
        difficulty: `${classification.difficultyRating}/5`,
        category: classification.primaryCategory,
        evidence_objectivity: `${Math.round(classification.evidenceObjectivity * 100)}%`,
        committee_size: committee?.length || 0,
        selection_method: 'RBTS-weighted expertise matching'
      }
    });
    
  } catch (error) {
    console.error('[Classify] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Classification failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/arbitra/disputes/[id]/classify
 * Get existing classification and committee for a dispute
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const disputeId = params.id;
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get classification
    const { data: classification, error: classError } = await supabase
      .from('dispute_complexity_scores')
      .select('*')
      .eq('dispute_id', disputeId)
      .maybeSingle();
    
    if (classError && classError.code !== 'PGRST116') {
      throw classError;
    }
    
    // Get committee
    const { data: committee, error: commError } = await supabase
      .from('committee_assignments')
      .select(`
        *,
        agent:agent_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('dispute_id', disputeId)
      .order('rbts_rank', { ascending: true });
    
    if (commError) throw commError;
    
    return NextResponse.json({
      classified: !!classification,
      classification: classification || null,
      committee: committee || [],
      committee_size: committee?.length || 0
    });
    
  } catch (error) {
    console.error('[Classify GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classification' },
      { status: 500 }
    );
  }
}
