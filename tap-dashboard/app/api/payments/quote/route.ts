import { NextRequest, NextResponse } from 'next/server';
import {
  calculateMarketplaceFee,
  validateJobDetails,
  getTierFromScore,
  type JobDetails,
} from '@/lib/payments/marketplace';

/**
 * POST /api/payments/quote
 * 
 * Returns a marketplace fee quote for a job based on worker reputation.
 * 
 * Request Body:
 * {
 *   workerId: string,
 *   jobValue: number,
 *   complexity: 'low' | 'medium' | 'high' | 'critical',
 *   urgency: 'normal' | 'high' | 'urgent' | 'emergency'
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     jobValue: number,
 *     platformFee: number,
 *     workerReceives: number,
 *     feeRate: number,
 *     tier: string,
 *     breakdown: {
 *       baseFee: number,
 *       reputationDiscount: number,
 *       complexityPremium: number,
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
  workerId: string;
  jobValue: number;
  complexity?: JobDetails['complexity'];
  urgency?: JobDetails['urgency'];
}

interface QuoteResponse {
  success: boolean;
  data?: {
    jobValue: number;
    platformFee: number;
    workerReceives: number;
    feeRate: number;
    tier: string;
    breakdown: {
      baseFee: number;
      reputationDiscount: number;
      complexityPremium: number;
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

// In-memory cache for agent reputation scores (replace with DB in production)
const agentReputationCache = new Map<string, { score: number; updatedAt: Date }>();

// Quote expiration time (15 minutes)
const QUOTE_EXPIRY_MINUTES = 15;

/**
 * Get agent reputation score (mock implementation)
 * In production, fetch from database or reputation service
 */
async function getAgentReputationScore(agentId: string): Promise<number> {
  // Check cache first
  const cached = agentReputationCache.get(agentId);
  if (cached) {
    return cached.score;
  }

  // Mock: Generate deterministic score based on agentId
  const hash = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const mockScore = (hash % 100) + 1; // 1-100
  
  agentReputationCache.set(agentId, { score: mockScore, updatedAt: new Date() });
  
  return mockScore;
}

/**
 * Validate request body
 */
function validateRequest(body: Partial<QuoteRequest>): { valid: true; data: QuoteRequest } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body.workerId || typeof body.workerId !== 'string' || body.workerId.trim().length === 0) {
    errors.workerId = 'Worker ID is required and must be a non-empty string';
  }

  if (typeof body.jobValue !== 'number' || body.jobValue < 0) {
    errors.jobValue = 'Job value is required and must be a non-negative number';
  }

  if (body.jobValue! > 1000000) {
    errors.jobValue = 'Job value exceeds maximum allowed value ($1,000,000)';
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
      workerId: body.workerId!.trim(),
      jobValue: body.jobValue!,
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
 * POST handler for marketplace fee quotes
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

    const { workerId, jobValue, complexity, urgency } = validation.data;

    // Get worker reputation score
    let reputationScore: number;
    try {
      reputationScore = await getAgentReputationScore(workerId);
    } catch (error) {
      console.error('Failed to fetch worker reputation:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REPUTATION_FETCH_ERROR',
            message: 'Failed to fetch worker reputation score',
          },
        },
        { status: 500 }
      );
    }

    // Validate job details
    const jobDetails = validateJobDetails({ value: jobValue, complexity, urgency });

    // Calculate marketplace fee
    const quote = calculateMarketplaceFee(jobDetails, reputationScore);

    // Build response
    const response: QuoteResponse = {
      success: true,
      data: {
        jobValue: quote.jobValue,
        platformFee: quote.platformFee,
        workerReceives: quote.workerReceives,
        feeRate: quote.feeRate,
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
 * Get marketplace fee information and tier details
 */
export async function GET(): Promise<NextResponse> {
  const { TIER_CONFIG, COMPLEXITY_PREMIUMS, URGENCY_PREMIUMS, BASE_FEE_RATE } = await import('@/lib/payments/marketplace');

  return NextResponse.json({
    success: true,
    data: {
      tiers: Object.values(TIER_CONFIG).map(tier => ({
        name: tier.name,
        scoreRange: `${tier.minScore}-${tier.maxScore}`,
        feeRate: tier.feeRate,
        discount: tier.discount,
        description: tier.description,
        benefits: tier.benefits,
      })),
      complexityPremiums: COMPLEXITY_PREMIUMS,
      urgencyPremiums: URGENCY_PREMIUMS,
      baseFeeRate: BASE_FEE_RATE,
      quoteExpiryMinutes: QUOTE_EXPIRY_MINUTES,
    },
  });
}
