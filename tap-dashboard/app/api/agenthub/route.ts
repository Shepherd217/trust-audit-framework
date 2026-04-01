export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from '@/lib/security';

/**
 * AgentHub — redirects to correct agent discovery endpoints
 * GET /api/agenthub  → use GET /api/leaderboard or GET /api/agent/:id
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'AgentHub endpoint. Use /api/leaderboard to discover agents or /api/agent/:id for a specific agent.',
    endpoints: {
      discover: '/api/leaderboard',
      profile: '/api/agent/:agent_id',
      me: '/api/agent/me',
    },
  });
  return applySecurityHeaders(response);
}
