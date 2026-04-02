export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cancelExecution } from '@/lib/claw/scheduler';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, 'critical');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    // Parse optional reason from body
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // No body or invalid JSON - that's okay
    }
    
    // Cancel the execution
    await cancelExecution(id, reason);
    
    const response = NextResponse.json({ 
      success: true,
      message: `Execution ${id} cancelled successfully`,
      executionId: id
    }, { status: 200 });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Cancel execution error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel execution';
    const status = message.includes('not found') ? 404 : 
                   message.includes('Cannot cancel') ? 400 : 500;
    
    const response = NextResponse.json(
      { error: message },
      { status }
    );
    return applySecurityHeaders(response);
  }
}
