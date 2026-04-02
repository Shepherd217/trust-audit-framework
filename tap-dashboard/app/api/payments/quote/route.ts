export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  generatePriceQuote,
  validatePricingFactors,
  AgentMetrics,
  PricingFactors,
} from '@/lib/payments/pricing';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * POST /api/payments/quote
 * 
 * Returns a price quote for an agent based on their reputation and task factors.
 * 
 * Request Body:
 * {
 *   agentId: string,
 *   basePrice: number,
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
 *     multiplier: number,
 *     tier: string,
 *     breakdown: {
 *       basePrice: number,
 *       tierMultiplier: number,
 *       tierDiscount: number,
 *       complexityFactor: number,
 *       complexityPremium: number,
 *       urgencyFactor: number,
 *       urgencyPremium: number
 *     },
 *     reputation: {
 *       score: number,
 *       tier: string,
 *       nextTier?: string,
 *       pointsToNextTier?: number
 *     }
 *   }
 * }
 */

interface QuoteRequest {
  agentId: string;
  basePrice: number;
  complexity?: PricingFactors['complexity'];
  urgency?: PricingFactors['urgency'];
}

interface QuoteResponse {
  success: boolean;
  data?: {
    agentId: string;
    basePrice: number;
    finalPrice: number;
    multiplier: number;
    tier: string;
    breakdown: {
      basePrice: number;
      tierMultiplier: number;
      tierDiscount: number;
      complexityFactor: number;
      complexityPremium: number;
      urgencyFactor: number;
      urgencyPremium: number;
    };
    reputation: {
      score: number;
      tier: string;
      nextTier?: string;
      pointsToNextTier?: number;
    };
    quoteId: string;
    expiresAt: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

// Quote expiration time (15 minutes)
const QUOTE_EXPIRY_MINUTES = 15;

/**
 * Get agent reputation score from database
 */
async function getAgentReputationScore(agentId: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('reputation')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch agent reputation:', error);
    throw new Error(`Agent not found: ${agentId}`);
  }

  return data?.reputation ?? 50; // Default to 50 if no reputation
}

/**
 * Validate request body
 */
function validateRequest(body: Partial<QuoteRequest>): { valid: true; data: QuoteRequest } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.agentId || typeof body.agentId !== 'string' || body.agentId.trim().length === 0) {
    errors.agentId = 'Agent ID is required and must be a non-empty string';
  }

  if (typeof body.basePrice !== 'number' || body.basePrice < 0) {
    errors.basePrice = 'Base price is required and must be a non-negative number';
  }

  if (body.basePrice! > 1000000) {
    errors.basePrice = 'Base price exceeds maximum allowed value ($1,000,000)';
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
      agentId: body.agentId!.trim(),
      basePrice: body.basePrice!,
      complexity: body.complexity || 'medium',
      urgency: body.urgency || 'normal',
    },
  };
}

/**
 * Generate unique quote ID
 */
function generateQuoteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `quote_${timestamp}_${random}`;
}

/**
 * Calculate expiration time
 */
function getExpiryTime(): Date {
  return new Date(Date.now() + QUOTE_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * POST handler for price quotes
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: Partial<QuoteRequest>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        },
        { status: 400 }
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validation.errors,
          },
        },
        { status: 400 }
      );
    }

    const { agentId, basePrice, complexity, urgency } = validation.data;

    // Get agent reputation score
    let reputationScore: number;
    try {
      reputationScore = await getAgentReputationScore(agentId);
    } catch (error) {
      console.error('Failed to fetch agent reputation:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REPUTATION_FETCH_ERROR',
            message: 'Failed to fetch agent reputation score',
          },
        },
        { status: 500 }
      );
    }

    // Validate pricing factors
    const factors = validatePricingFactors({ complexity, urgency });

    // Generate price quote
    const quote = generatePriceQuote(agentId, basePrice, reputationScore, factors);

    // Build response
    const response: QuoteResponse = {
      success: true,
      data: {
        agentId: quote.agentId,
        basePrice: quote.basePrice,
        finalPrice: quote.finalPrice,
        multiplier: quote.multiplier,
        tier: quote.tier,
        breakdown: quote.breakdown,
        reputation: quote.reputation,
        quoteId: generateQuoteId(),
        expiresAt: getExpiryTime().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Quote generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/quote
 * 
 * Get pricing information and tier details
 */
export async function GET(): Promise<NextResponse> {
  const { TIER_CONFIG, COMPLEXITY_FACTORS, URGENCY_FACTORS } = await import('@/lib/payments/pricing');

  return NextResponse.json({
    success: true,
    data: {
      tiers: Object.values(TIER_CONFIG).map(tier => ({
        name: tier.name,
        scoreRange: `${tier.minScore}-${tier.maxScore}`,
        multiplier: tier.multiplier,
        description: tier.description,
        benefits: tier.benefits,
      })),
      complexityFactors: COMPLEXITY_FACTORS,
      urgencyFactors: URGENCY_FACTORS,
      quoteExpiryMinutes: QUOTE_EXPIRY_MINUTES,
    },
  });
}