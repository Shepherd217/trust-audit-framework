export const dynamic = 'force-dynamic';

/**
 * Cost Projection API
 * GET: Get cost projections based on usage patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateCostProjection, getUsageSummary } from '@/lib/payments/micropayments';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    const projection = await calculateCostProjection(userId);
    
    // Get current month's usage so far
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = await getUsageSummary(userId, monthStart, now);
    
    return NextResponse.json({
      success: true,
      projection: {
        currentMonth: {
          spentSoFar: Math.round(summary.totalCost * 10000) / 10000,
          estimatedTotal: projection.currentMonthEstimate,
          remainingDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(),
        },
        nextMonth: {
          estimated: projection.nextMonthEstimate,
        },
        trends: {
          dailyAverage: projection.dailyAverage,
          direction: projection.trend,
          confidence: projection.confidence,
        },
        breakdown: {
          byAction: summary.actionBreakdown,
          byAgent: summary.agentBreakdown,
        },
      },
    });
    
  } catch (error: any) {
    console.error('[Cost Projection API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate projection', code: 'PROJECTION_ERROR' },
      { status: 500 }
    );
  }
}