import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/arbitra/committee/select
 * Select committee for a dispute using RBTS + expertise weighting
 */

const selectSchema = z.object({
  dispute_id: z.string().uuid(),
  committee_size: z.number().min(3).max(11).default(7),
  target_domain: z.enum([
    'software', 'infrastructure', 'data_analytics', 'creative', 'research', 'administrative',
    'defi_tokenomics', 'technical_architecture', 'legal_compliance', 'governance_operations', 'market_strategy'
  ]).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dispute_id, committee_size, target_domain } = selectSchema.parse(body);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check if dispute has classification
    const { data: complexity } = await supabase
      .from('dispute_complexity_scores')
      .select('difficulty_rating, primary_category')
      .eq('dispute_id', dispute_id)
      .single();
    
    // Adjust committee size based on difficulty if not specified
    const finalSize = committee_size || (complexity?.difficulty_rating >= 4 ? 7 : 5);
    
    console.log(`[Committee] Selecting ${finalSize} members for dispute ${dispute_id}`);
    
    // Call RPC to select committee
    const { data: committee, error } = await supabase.rpc('select_committee', {
      p_dispute_id: dispute_id,
      p_committee_size: finalSize,
      p_target_domain: target_domain || null
    });
    
    if (error) {
      console.error('[Committee] RPC error:', error);
      return NextResponse.json(
        { error: 'Committee selection failed', details: error.message },
        { status: 500 }
      );
    }
    
    if (!committee || committee.length === 0) {
      return NextResponse.json(
        { error: 'Insufficient qualified agents for committee' },
        { status: 422 }
      );
    }
    
    // Save assignments
    const assignments = committee.map((member: any) => ({
      dispute_id,
      round: 1,
      agent_id: member.agent_id,
      selection_method: 'rbts',
      rbts_rank: member.rbts_rank,
      expertise_score_at_selection: member.voting_weight,
      domain_match_score: member.domain_match_score,
      voting_weight: member.voting_weight,
      selected_at: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
      .from('committee_assignments')
      .insert(assignments);
    
    if (insertError) {
      console.error('[Committee] Failed to save assignments:', insertError);
    }
    
    return NextResponse.json({
      success: true,
      dispute_id,
      committee_size: finalSize,
      selected: committee.length,
      committee: committee.map((m: any) => ({
        agent_id: m.agent_id,
        voting_weight: m.voting_weight,
        selection_reason: m.selection_reason,
        rbts_rank: m.rbts_rank,
        domain_match_score: m.domain_match_score
      })),
      difficulty_based_adjustment: complexity ? {
        difficulty_rating: complexity.difficulty_rating,
        adjusted_committee_size: finalSize
      } : null
    });
    
  } catch (error) {
    console.error('[Committee] Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Committee selection failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/arbitra/committee/available
 * List available agents for committee selection with their expertise
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') as any;
    const tier = searchParams.get('tier') as any;
    const minExpertise = parseFloat(searchParams.get('min_expertise') || '0.5');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    let query = supabase
      .from('committee_expertise_profiles')
      .select(`
        *,
        agent:agent_id (
          id,
          name,
          avatar_url,
          karma
        )
      `)
      .gte('expertise_score', minExpertise)
      .order('expertise_score', { ascending: false })
      .limit(50);
    
    if (domain) {
      query = query.eq('domain', domain);
    }
    
    if (tier) {
      query = query.eq('current_tier', tier);
    }
    
    const { data: agents, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      count: agents?.length || 0,
      agents: agents || []
    });
    
  } catch (error) {
    console.error('[Committee GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available agents' },
      { status: 500 }
    );
  }
}
