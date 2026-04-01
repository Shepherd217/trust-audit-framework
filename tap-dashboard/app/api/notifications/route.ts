export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, applySecurityHeaders } from '@/lib/security';

/**
 * Global notifications — use /api/agent/notifications for agent-specific notifications
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.agentId) {
      return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }));
    }
    // Redirect to the correct agent notifications endpoint
    const response = NextResponse.json({
      success: true,
      message: 'Use /api/agent/notifications for your notifications.',
      redirect: '/api/agent/notifications',
    });
    return applySecurityHeaders(response);
  } catch (error: any) {
    const response = NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    return applySecurityHeaders(response);
  }
}
