export const dynamic = 'force-dynamic';
/**
 * Usage Tracking API
 * POST: Log usage event (agentId, action, quantity, cost)
 * GET: Get usage summary for billing period
 * WebSocket: Real-time usage updates
 * 
 * Reference: Inspired by Stripe's event-driven architecture
 * Every action is visible, traceable, and auditable.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  trackUsage,
  getUsageSummary,
  getUserBalance,
  UsageAction,
  UsageEvent,
  MicropaymentService,
} from '@/lib/payments/micropayments';

// ============================================================================
// POST: Log Usage Event
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { userId, action, quantity, metadata, agentId, sessionId } = body;
    
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'action is required', code: 'MISSING_ACTION' },
        { status: 400 }
      );
    }
    
    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'quantity must be a positive number', code: 'INVALID_QUANTITY' },
        { status: 400 }
      );
    }
    
    // Validate action type
    const validActions: UsageAction[] = [
      'api_call',
      'token_input',
      'token_output',
      'compute_second',
      'task_completed',
      'task_failed',
      'storage_gb',
      'bandwidth_gb',
      'websocket_connection',
    ];
    
    if (!validActions.includes(action as UsageAction)) {
      return NextResponse.json(
        { 
          error: 'Invalid action type', 
          code: 'INVALID_ACTION',
          validActions,
        },
        { status: 400 }
      );
    }
    
    // Track the usage
    const event = await trackUsage(userId, action as UsageAction, quantity, {
      agentId,
      sessionId,
      metadata,
    });
    
    // Get updated balance
    const balance = await getUserBalance(userId);
    
    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        action: event.action,
        quantity: event.quantity,
        unitCost: event.unitCost,
        totalCost: event.totalCost,
        currency: event.currency,
        timestamp: event.timestamp.toISOString(),
        billed: event.billed,
      },
      balance: {
        current: Math.round(balance.balance * 10000) / 10000,
        currency: balance.currency,
      },
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('[Usage Tracking] Error:', error);
    
    // Handle specific error types
    if (error.name === 'InsufficientBalanceError') {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INSUFFICIENT_BALANCE',
          details: error.details,
        },
        { status: 402 } // Payment Required
      );
    }
    
    return NextResponse.json(
      {
        error: error.message || 'Failed to track usage',
        code: 'TRACKING_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Usage Summary for Billing Period
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    // Default to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format', code: 'INVALID_DATE' },
        { status: 400 }
      );
    }
    
    if (start > end) {
      return NextResponse.json(
        { error: 'startDate must be before endDate', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      );
    }
    
    const summary = await getUsageSummary(userId, start, end);
    
    return NextResponse.json({
      success: true,
      summary: {
        userId: summary.userId,
        period: {
          start: summary.period.start.toISOString(),
          end: summary.period.end.toISOString(),
        },
        totalCost: Math.round(summary.totalCost * 10000) / 10000,
        currency: summary.currency,
        actionBreakdown: summary.actionBreakdown,
        agentBreakdown: summary.agentBreakdown,
        dailyTrend: summary.dailyTrend,
      },
    });
    
  } catch (error: any) {
    console.error('[Usage Summary] Error:', error);
    
    return NextResponse.json(
      {
        error: error.message || 'Failed to get usage summary',
        code: 'SUMMARY_ERROR',
      },
      { status: 500 }
    );
  }
}
