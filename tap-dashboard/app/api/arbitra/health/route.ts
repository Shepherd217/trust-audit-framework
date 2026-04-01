import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

/**
 * GET /api/arbitra/health
 * Health check for ARBITER integration with detailed status
 */

export async function GET(request: NextRequest) {
  const checks: Record<string, { status: 'ok' | 'warning' | 'error'; message: string; details?: any }> = {};
  
  // Check 1: Database connectivity
  try {
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('arbitra_external_verdicts')
      .select('count')
      .limit(1);
    
    if (error && error.code === '42P01') {
      checks.database = {
        status: 'error',
        message: 'Migration 026 not applied - tables missing'
      };
    } else if (error) {
      checks.database = {
        status: 'error',
        message: error.message
      };
    } else {
      checks.database = {
        status: 'ok',
        message: 'Database connected'
      };
    }
  } catch (err) {
    checks.database = {
      status: 'error',
      message: (err as Error).message
    };
  }
  
  // Check 2: Webhook secret configured
  checks.webhook_secret = process.env.ARBITER_WEBHOOK_SECRET
    ? { status: 'ok', message: 'Webhook secret configured' }
    : { status: 'error', message: 'ARBITER_WEBHOOK_SECRET not set' };
  
  // Check 3: Recent verdicts
  try {
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: recentVerdicts } = await supabase
      .from('arbitra_external_verdicts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    checks.recent_verdicts = {
      status: 'ok',
      message: `${recentVerdicts?.length || 0} verdicts in database`,
      details: recentVerdicts?.map(v => ({
        id: v.verdict_id,
        resolution: v.resolution,
        created_at: v.created_at
      }))
    };
  } catch (err) {
    checks.recent_verdicts = {
      status: 'warning',
      message: 'Could not fetch recent verdicts'
    };
  }
  
  // Check 4: Committee Intelligence tables
  try {
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { count: classifications } = await supabase
      .from('dispute_complexity_scores')
      .select('*', { count: 'exact', head: true });
    
    const { count: committees } = await supabase
      .from('committee_assignments')
      .select('*', { count: 'exact', head: true });
    
    const { count: experts } = await supabase
      .from('committee_expertise_profiles')
      .select('*', { count: 'exact', head: true });
    
    checks.committee_intelligence = {
      status: 'ok',
      message: 'CI tables accessible',
      details: {
        classifications: classifications || 0,
        committee_assignments: committees || 0,
        expertise_profiles: experts || 0
      }
    };
  } catch (err) {
    checks.committee_intelligence = {
      status: 'warning',
      message: 'CI tables may not be migrated yet'
    };
  }
  
  // Check 5: AutoPilotAI test readiness
  const testDate = new Date('2026-03-26T14:00:00Z');
  const now = new Date();
  const hoursUntilTest = (testDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilTest < 0) {
    checks.test_window = {
      status: 'warning',
      message: 'Test window (March 26 14:00 UTC) has passed'
    };
  } else if (hoursUntilTest < 24) {
    checks.test_window = {
      status: 'ok',
      message: `Test window in ${Math.round(hoursUntilTest)} hours`
    };
  } else {
    checks.test_window = {
      status: 'ok',
      message: `Test window in ${Math.round(hoursUntilTest / 24)} days`
    };
  }
  
  // Overall status
  const hasErrors = Object.values(checks).some(c => c.status === 'error');
  const hasWarnings = Object.values(checks).some(c => c.status === 'warning');
  
  const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok';
  
  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    endpoint: '/api/arbitra/verdict',
    webhook_url: 'https://moltos.org/api/arbitra/verdict',
    test_plan: 'docs/ARBITER_INTEGRATION_TEST_PLAN.md',
    auto_pilot_ai: {
      status: 'scheduled',
      date: '2026-03-26T14:00:00Z',
      time_until: `${Math.round(hoursUntilTest)} hours`
    },
    checks
  }, {
    status: hasErrors ? 503 : 200
  });
}
