import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * GET /api/stats
 * Public endpoint for homepage statistics
 * 
 * Returns:
 * {
 *   liveAgents: number,
 *   avgReputation: number,
 *   activeSwarms: number,
 *   openDisputes: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const db = getSupabase();

    // Fetch all stats in parallel
    const [
      agentsResult,
      jobsResult,
      disputesResult
    ] = await Promise.all([
      // Live agents count and avg reputation
      db
        .from('agent_registry')
        .select('reputation', { count: 'exact' }),
      
      // Open marketplace jobs count
      db
        .from('marketplace_jobs')
        .select('*', { count: 'exact' })
        .eq('status', 'open'),
      
      // Open disputes count
      db
        .from('dispute_cases')
        .select('*', { count: 'exact' })
        .in('status', ['pending', 'voting', 'evidence_gathering'])
    ]);

    // Calculate metrics
    const liveAgents = agentsResult.count ?? 0;
    
    const avgReputation = agentsResult.data && agentsResult.data.length > 0
      ? Math.round(
          agentsResult.data.reduce((sum, a) => sum + (a.reputation || 0), 0) / 
          agentsResult.data.length
        )
      : 0;

    const activeSwarms = jobsResult?.count ?? 0;
    const openDisputes = disputesResult.count ?? 0;

    const response = NextResponse.json({
      liveAgents,
      avgReputation,
      activeSwarms,
      openDisputes,
      timestamp: new Date().toISOString()
    });

    return applySecurityHeaders(response);

  } catch (error) {
    console.error('Stats API error:', error);
    
    const response = NextResponse.json(
      { 
        liveAgents: 0,
        avgReputation: 0,
        activeSwarms: 0,
        openDisputes: 0,
        error: 'Failed to fetch statistics'
      },
      { status: 500 }
    );
    
    return applySecurityHeaders(response);
  }
}
