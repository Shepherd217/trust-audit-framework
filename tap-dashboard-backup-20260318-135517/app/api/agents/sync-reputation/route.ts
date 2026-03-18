import { NextRequest, NextResponse } from 'next/server';
import {
  calculateReputationScore,
  getTierFromScore,
  AgentMetrics,
  ReputationScore,
  TIER_CONFIG,
} from '@/lib/payments/pricing';

/**
 * POST /api/agents/sync-reputation
 * 
 * Updates agent reputation scores based on completed tasks.
 * Calculates metrics: completion rate, accuracy, and response time.
 * 
 * Request Body (single agent or batch):
 * {
 *   // Single agent update
 *   agentId: string,
 *   metrics: {
 *     tasksCompleted: number,
 *     tasksAssigned: number,
 *     errors: number,
 *     totalActions: number,
 *     avgResponseTimeMs: number,
 *     baselineResponseTimeMs: number
 *   }
 * }
 * 
 * OR
 * 
 * {
 *   // Batch update
 *   batch: [
 *     { agentId: string, metrics: AgentMetrics },
 *     ...
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     agentId: string,
 *     previousScore: number,
 *     newScore: number,
 *     tier: string,
 *     tierChanged: boolean,
 *     metrics: {
 *       completionRate: number,
 *       accuracyScore: number,
 *       responseTimeScore: number
 *     },
 *     breakdown: {
 *       completionContribution: number,
 *       accuracyContribution: number,
 *       responseTimeContribution: number
 *     }
 *   }
 * }
 */

interface SingleSyncRequest {
  agentId: string;
  metrics: AgentMetrics;
}

interface BatchSyncRequest {
  batch: SingleSyncRequest[];
}

type SyncRequest = SingleSyncRequest | BatchSyncRequest;

interface SyncResult {
  agentId: string;
  previousScore: number;
  newScore: number;
  tier: string;
  previousTier?: string;
  tierChanged: boolean;
  metrics: {
    completionRate: number;
    accuracyScore: number;
    responseTimeScore: number;
  };
  breakdown: {
    completionContribution: number;
    accuracyContribution: number;
    responseTimeContribution: number;
  };
  progressToNextTier?: {
    nextTier: string;
    pointsNeeded: number;
    percentage: number;
  };
}

interface SyncResponse {
  success: boolean;
  data?: SyncResult | SyncResult[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, string> | Array<{ agentId: string; error: string }>;
  };
}

// In-memory store for agent scores (replace with database in production)
interface AgentReputationRecord {
  agentId: string;
  score: number;
  tier: string;
  metrics: AgentMetrics;
  history: {
    score: number;
    tier: string;
    timestamp: Date;
  }[];
  updatedAt: Date;
}

const agentReputationStore = new Map<string, AgentReputationRecord>();

/**
 * Validate agent metrics
 */
function validateMetrics(metrics: Partial<AgentMetrics>, prefix = ''): { valid: true; data: AgentMetrics } | { valid: false; error: string } {
  const errors: string[] = [];

  if (typeof metrics.tasksCompleted !== 'number' || metrics.tasksCompleted < 0 || !Number.isInteger(metrics.tasksCompleted)) {
    errors.push(`${prefix}tasksCompleted must be a non-negative integer`);
  }

  if (typeof metrics.tasksAssigned !== 'number' || metrics.tasksAssigned < 0 || !Number.isInteger(metrics.tasksAssigned)) {
    errors.push(`${prefix}tasksAssigned must be a non-negative integer`);
  }

  if (metrics.tasksCompleted! > metrics.tasksAssigned!) {
    errors.push(`${prefix}tasksCompleted cannot exceed tasksAssigned`);
  }

  if (typeof metrics.errors !== 'number' || metrics.errors < 0 || !Number.isInteger(metrics.errors)) {
    errors.push(`${prefix}errors must be a non-negative integer`);
  }

  if (typeof metrics.totalActions !== 'number' || metrics.totalActions < 0 || !Number.isInteger(metrics.totalActions)) {
    errors.push(`${prefix}totalActions must be a non-negative integer`);
  }

  if (metrics.errors! > metrics.totalActions!) {
    errors.push(`${prefix}errors cannot exceed totalActions`);
  }

  if (typeof metrics.avgResponseTimeMs !== 'number' || metrics.avgResponseTimeMs < 0) {
    errors.push(`${prefix}avgResponseTimeMs must be a non-negative number`);
  }

  if (typeof metrics.baselineResponseTimeMs !== 'number' || metrics.baselineResponseTimeMs <= 0) {
    errors.push(`${prefix}baselineResponseTimeMs must be a positive number`);
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return {
    valid: true,
    data: metrics as AgentMetrics,
  };
}

/**
 * Check if request is a batch request
 */
function isBatchRequest(body: SyncRequest): body is BatchSyncRequest {
  return 'batch' in body && Array.isArray(body.batch);
}

/**
 * Get or create agent record
 */
function getAgentRecord(agentId: string): AgentReputationRecord {
  const existing = agentReputationStore.get(agentId);
  if (existing) {
    return existing;
  }

  // Create new record with default values
  const newRecord: AgentReputationRecord = {
    agentId,
    score: 0,
    tier: 'Novice',
    metrics: {
      tasksCompleted: 0,
      tasksAssigned: 0,
      errors: 0,
      totalActions: 0,
      avgResponseTimeMs: 0,
      baselineResponseTimeMs: 5000, // 5 second default baseline
    },
    history: [],
    updatedAt: new Date(),
  };

  agentReputationStore.set(agentId, newRecord);
  return newRecord;
}

/**
 * Calculate progress to next tier
 */
function calculateProgressToNextTier(score: number): { nextTier: string; pointsNeeded: number; percentage: number } | undefined {
  const tierNames = ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const;
  const currentTier = getTierFromScore(score);
  const currentIndex = tierNames.indexOf(currentTier);

  if (currentIndex >= tierNames.length - 1) {
    return undefined; // At max tier
  }

  const nextTierName = tierNames[currentIndex + 1];
  const nextTierConfig = TIER_CONFIG[nextTierName];
  const pointsNeeded = nextTierConfig.minScore - score;
  const tierRange = nextTierConfig.minScore - TIER_CONFIG[currentTier].minScore;
  const percentage = Math.min(100, Math.round(((score - TIER_CONFIG[currentTier].minScore) / tierRange) * 100));

  return {
    nextTier: nextTierName,
    pointsNeeded,
    percentage,
  };
}

/**
 * Sync reputation for a single agent
 */
function syncAgentReputation(agentId: string, metrics: AgentMetrics): SyncResult {
  const record = getAgentRecord(agentId);
  const previousScore = record.score;
  const previousTier = record.tier;

  // Calculate new reputation score
  const reputationResult = calculateReputationScore(metrics);

  // Determine new tier
  const newTier = getTierFromScore(reputationResult.score);

  // Update record
  record.score = reputationResult.score;
  record.tier = newTier;
  record.metrics = metrics;
  record.history.push({
    score: previousScore,
    tier: previousTier,
    timestamp: record.updatedAt,
  });
  record.updatedAt = new Date();

  // Calculate progress to next tier
  const progressToNextTier = calculateProgressToNextTier(reputationResult.score);

  return {
    agentId,
    previousScore,
    newScore: reputationResult.score,
    tier: newTier,
    previousTier,
    tierChanged: previousTier !== newTier,
    metrics: {
      completionRate: reputationResult.completionRate,
      accuracyScore: reputationResult.accuracyScore,
      responseTimeScore: reputationResult.responseTimeScore,
    },
    breakdown: reputationResult.breakdown,
    progressToNextTier: progressToNextTier || undefined,
  };
}

/**
 * POST handler for reputation sync
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: SyncRequest;
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

    // Handle batch request
    if (isBatchRequest(body)) {
      if (!body.batch || body.batch.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMPTY_BATCH',
              message: 'Batch array cannot be empty',
            },
          },
          { status: 400 }
        );
      }

      if (body.batch.length > 100) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BATCH_TOO_LARGE',
              message: 'Maximum batch size is 100 agents',
            },
          },
          { status: 400 }
        );
      }

      const results: SyncResult[] = [];
      const errors: { agentId: string; error: string }[] = [];

      for (const item of body.batch) {
        if (!item.agentId || typeof item.agentId !== 'string') {
          errors.push({ agentId: item.agentId || 'unknown', error: 'agentId is required' });
          continue;
        }

        const validation = validateMetrics(item.metrics);
        if (!validation.valid) {
          errors.push({ agentId: item.agentId, error: validation.error });
          continue;
        }

        try {
          const result = syncAgentReputation(item.agentId, validation.data);
          results.push(result);
        } catch (error) {
          errors.push({
            agentId: item.agentId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (errors.length > 0 && results.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BATCH_PROCESSING_ERROR',
              message: 'All batch items failed validation',
              details: errors,
            },
          },
          { status: 400 }
        );
      }

      const response: SyncResponse = {
        success: true,
        data: results,
      };

      // Include partial errors if some items failed
      if (errors.length > 0) {
        return NextResponse.json(
          {
            ...response,
            partialErrors: errors,
          },
          { status: 207 } // Multi-Status
        );
      }

      return NextResponse.json(response, { status: 200 });
    }

    // Handle single agent request
    if (!body.agentId || typeof body.agentId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'agentId is required and must be a string',
          },
        },
        { status: 400 }
      );
    }

    const validation = validateMetrics((body as SingleSyncRequest).metrics);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error,
          },
        },
        { status: 400 }
      );
    }

    const result = syncAgentReputation(body.agentId, validation.data);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Reputation sync error:', error);
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
 * GET /api/agents/sync-reputation
 * 
 * Get reputation data for an agent or list all agents
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (agentId) {
    const record = agentReputationStore.get(agentId);
    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentId} not found`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId: record.agentId,
        score: record.score,
        tier: record.tier,
        metrics: record.metrics,
        history: record.history.slice(-10), // Last 10 updates
        updatedAt: record.updatedAt.toISOString(),
      },
    });
  }

  // Return all agents summary
  const allAgents = Array.from(agentReputationStore.values()).map(record => ({
    agentId: record.agentId,
    score: record.score,
    tier: record.tier,
    updatedAt: record.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    success: true,
    data: {
      count: allAgents.length,
      agents: allAgents,
    },
  });
}

/**
 * DELETE /api/agents/sync-reputation
 * 
 * Reset or delete agent reputation data (admin only)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  if (!agentId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_AGENT_ID',
          message: 'agentId query parameter is required',
        },
      },
      { status: 400 }
    );
  }

  const existed = agentReputationStore.has(agentId);
  agentReputationStore.delete(agentId);

  return NextResponse.json({
    success: true,
    data: {
      agentId,
      deleted: existed,
      message: existed ? 'Agent reputation data deleted' : 'Agent not found',
    },
  });
}