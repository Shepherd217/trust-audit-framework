import { NextRequest, NextResponse } from 'next/server';
import { runEigenTrustCalculation, getAgentTrustScore, getTrustNetwork } from '@/lib/eigentrust';

// Force dynamic rendering - this API route requires runtime DB access
export const dynamic = 'force-dynamic';

/**
 * POST /api/eigentrust
 * Trigger EigenTrust recalculation
 * 
 * Body (optional):
 * {
 *   alpha?: number,           // Damping factor (0-1), default 0.85
 *   epsilon?: number,         // Convergence threshold, default 1e-6
 *   maxIterations?: number,   // Max iterations, default 1000
 *   timeWindowDays?: number   // Lookback window (0 = all time)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse optional config from body
    const body = await request.json().catch(() => ({}));
    
    const config = {
      alpha: body.alpha,
      epsilon: body.epsilon,
      maxIterations: body.maxIterations,
      timeWindowDays: body.timeWindowDays,
    };

    // Run the calculation
    const result = await runEigenTrustCalculation(config);

    return NextResponse.json({
      success: true,
      message: 'EigenTrust calculation complete',
      result: {
        agentsCalculated: result.scores.size,
        iterations: result.iterations,
        convergenceDelta: result.convergenceDelta,
        timestamp: result.timestamp,
      },
    });

  } catch (error) {
    console.error('EigenTrust API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'EigenTrust calculation failed',
    }, { status: 500 });
  }
}

/**
 * GET /api/eigentrust
 * Get trust score for a specific agent
 * 
 * Query params:
 *   agent_id: string (required)
 *   network: boolean (optional) - include trust network data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const includeNetwork = searchParams.get('network') === 'true';

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'agent_id is required',
      }, { status: 400 });
    }

    // Get trust score
    const score = await getAgentTrustScore(agentId);

    if (!score) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found',
      }, { status: 404 });
    }

    const response: any = {
      success: true,
      agent_id: agentId,
      score: score.score,
      tier: score.tier,
      percentile: score.percentile,
    };

    // Optionally include network data
    if (includeNetwork) {
      const network = await getTrustNetwork(agentId);
      response.network = network;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('EigenTrust GET error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trust score',
    }, { status: 500 });
  }
}
