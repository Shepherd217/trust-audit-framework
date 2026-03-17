import { NextRequest, NextResponse } from 'next/server';
import { 
  calculateQuote, 
  validatePricingFactors,
  getTierFromScore,
  PLATFORM_CONFIG 
} from '@/lib/payments/pricing';

/**
 * POST /api/payments/quote
 * 
 * Returns a price quote for hiring an agent.
 * 
 * IMPORTANT: TAP score is for TRANSPARENCY only — it does NOT affect pricing.
 * Agents set their own rates freely. TAP score affects visibility only.
 * 
 * Request Body:
 * {
 *   agentId: string,
 *   basePrice: number,        // Agent's asking price
 *   complexity: 'low' | 'medium' | 'high' | 'critical',
 *   urgency: 'normal' | 'high' | 'urgent' | 'emergency'
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     agentId: string,
 *     basePrice: number,
 *     finalPrice: number,
 *     platformFee: number,      // Flat 2.5%
 *     agentEarnings: number,    // 97.5%
 *     breakdown: { ... },
 *     tapInfo: {                // For transparency only
 *       score: number,
 *       tier: string,
 *       attestations: number
 *     }
 *   }
 * }
 */

interface QuoteRequest {
  agentId: string;
  basePrice: number;
  complexity?: 'low' | 'medium' | 'high' | 'critical';
  urgency?: 'normal' | 'high' | 'urgent' | 'emergency';
}

// In-memory cache for TAP scores (5 min TTL)
const tapCache = new Map<string, { score: number; attestations: number; updatedAt: Date }>();

async function getTAPInfo(agentId: string): Promise<{ score: number; tier: string; attestations: number }> {
  // Check cache
  const cached = tapCache.get(agentId);
  if (cached && Date.now() - cached.updatedAt.getTime() < 5 * 60 * 1000) {
    return {
      score: cached.score,
      tier: getTierFromScore(cached.score),
      attestations: cached.attestations,
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON || ''
    );

    // Fetch TAP score
    const { data: tapData } = await supabase
      .from('tap_scores')
      .select('tap_score, total_attestations_received')
      .eq('claw_id', agentId)
      .single();

    const score = tapData?.tap_score ?? 0;
    const attestations = tapData?.total_attestations_received ?? 0;

    tapCache.set(agentId, { score, attestations, updatedAt: new Date() });

    return {
      score,
      tier: getTierFromScore(score),
      attestations,
    };
  } catch {
    return { score: 0, tier: 'Novice', attestations: 0 };
  }
}

function validateRequest(body: Partial<QuoteRequest>): 
  | { valid: true; data: QuoteRequest }
  | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.agentId || typeof body.agentId !== 'string') {
    errors.agentId = 'Agent ID is required';
  }

  if (typeof body.basePrice !== 'number' || body.basePrice < 0) {
    errors.basePrice = 'Base price must be a non-negative number';
  } else if (body.basePrice > 1000000) {
    errors.basePrice = 'Base price exceeds maximum ($1,000,000)';
  }

  const validComplexity = ['low', 'medium', 'high', 'critical'];
  if (body.complexity && !validComplexity.includes(body.complexity)) {
    errors.complexity = `Complexity must be one of: ${validComplexity.join(', ')}`;
  }

  const validUrgency = ['normal', 'high', 'urgent', 'emergency'];
  if (body.urgency && !validUrgency.includes(body.urgency)) {
    errors.urgency = `Urgency must be one of: ${validUrgency.join(', ')}`;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      agentId: body.agentId!,
      basePrice: body.basePrice!,
      complexity: body.complexity || 'medium',
      urgency: body.urgency || 'normal',
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: Partial<QuoteRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', details: (validation as { valid: false; errors: Record<string, string> }).errors } },
        { status: 400 }
      );
    }

    const { agentId, basePrice, complexity, urgency } = validation.data;

    // Get TAP info for TRANSPARENCY only (does NOT affect price)
    const tapInfo = await getTAPInfo(agentId);

    // Calculate quote (TAP score NOT used in calculation)
    const factors = validatePricingFactors({ complexity, urgency });
    const quote = calculateQuote(agentId, basePrice, factors, tapInfo);

    return NextResponse.json({
      success: true,
      data: {
        agentId: quote.agentId,
        basePrice: quote.basePrice,
        finalPrice: quote.finalPrice,
        platformFee: quote.platformFee,
        agentEarnings: quote.agentEarnings,
        breakdown: quote.breakdown,
        tapInfo: quote.tapInfo,
        note: 'TAP score is for transparency only and does not affect pricing. Agents set their own rates.',
      },
    });

  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Unexpected error' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/quote
 * 
 * Returns platform pricing configuration
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      platformFee: {
        percent: PLATFORM_CONFIG.feePercent,
        minAmount: PLATFORM_CONFIG.minFeeAmount,
        maxAmount: PLATFORM_CONFIG.maxFeeAmount,
        description: 'Flat fee — does not vary by agent reputation',
      },
      agentShare: {
        percent: 97.5,
        description: 'Agent keeps 97.5% of task payment',
      },
      tapNote: 'TAP score affects marketplace visibility only. It does NOT affect pricing. Agents set their own rates freely.',
      reputationTiers: [
        { name: 'Bronze', minScore: 0, visibility: 'Limited' },
        { name: 'Silver', minScore: 2000, visibility: 'Standard' },
        { name: 'Gold', minScore: 4000, visibility: 'Featured' },
        { name: 'Platinum', minScore: 6000, visibility: 'Priority' },
        { name: 'Diamond', minScore: 8000, visibility: 'Elite' },
      ],
    },
  });
}
