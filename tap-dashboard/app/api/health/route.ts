export const dynamic = 'force-dynamic';
/**
 * MoltOS Health Check System
 * 
 * Comprehensive health monitoring for all system components.
 * Used by monitoring dashboards and alerting systems.
 * 
 * Endpoints:
 * - /api/health — Quick liveness check
 * - /api/health/detailed — Full system status
 * - /api/health/metrics — Prometheus-compatible metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions';
import { applySecurityHeaders } from '@/lib/security';

// Version from package.json
const VERSION = '0.25.0';

// Health check configuration
const HEALTH_CONFIG = {
  // Thresholds
  maxResponseTimeMs: 2000,
  minDatabaseConnections: 1,
  
  // Component timeouts
  timeouts: {
    database: 3000,
    external: 5000,
  }
};

// Component status types
type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  responseTimeMs: number;
  lastChecked: string;
  details?: Record<string, any>;
  error?: string;
}

interface HealthReport {
  status: ComponentStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// Lazy Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    // Test query with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), HEALTH_CONFIG.timeouts.database)
    );
    
    const queryPromise = getSupabase()
      .from('agent_registry')
      .select('count', { count: 'exact', head: true });
    
    const { count, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
    
    if (error) throw error;
    
    const responseTime = performance.now() - start;
    
    // Determine status based on response time
    let status: ComponentStatus = 'healthy';
    if (responseTime > HEALTH_CONFIG.maxResponseTimeMs) {
      status = 'degraded';
    }
    
    return {
      name: 'database',
      status,
      responseTimeMs: Math.round(responseTime),
      lastChecked: new Date().toISOString(),
      details: {
        connection: 'established',
        agentCount: count || 0
      }
    };
    
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: (error as Error).message
    };
  }
}

/**
 * Check Stripe API connectivity
 */
async function checkStripe(): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    const stripe = await import('stripe');
    const client = new stripe.default(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover'
    });
    
    // Lightweight balance check
    await client.balance.retrieve();
    
    const responseTime = performance.now() - start;
    
    return {
      name: 'stripe',
      status: responseTime > HEALTH_CONFIG.maxResponseTimeMs ? 'degraded' : 'healthy',
      responseTimeMs: Math.round(responseTime),
      lastChecked: new Date().toISOString(),
      details: { apiVersion: '2026-02-25.clover' }
    };
    
  } catch (error) {
    return {
      name: 'stripe',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: (error as Error).message
    };
  }
}

/**
 * Check BLS verification system
 */
async function checkBLS(): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    const { generateKeyPair, sign, verify } = await import('@/lib/bls');
    
    // Quick functional test
    const keypair = await generateKeyPair();
    const message = 'health-check';
    const signature = await sign(message, keypair.privateKey);
    const valid = await verify(message, signature, keypair.publicKey);
    
    if (!valid) throw new Error('BLS verification failed');
    
    const responseTime = performance.now() - start;
    
    return {
      name: 'bls_verification',
      status: 'healthy',
      responseTimeMs: Math.round(responseTime),
      lastChecked: new Date().toISOString(),
      details: { implementation: '@chainsafe/blst' }
    };
    
  } catch (error) {
    return {
      name: 'bls_verification',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: (error as Error).message
    };
  }
}

/**
 * Check notification system
 */
async function checkNotifications(): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    // Check if notification tables are accessible
    const { count, error } = await getSupabase()
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    const responseTime = performance.now() - start;
    
    return {
      name: 'notifications',
      status: 'healthy',
      responseTimeMs: Math.round(responseTime),
      lastChecked: new Date().toISOString(),
      details: { pendingNotifications: count || 0 }
    };
    
  } catch (error) {
    return {
      name: 'notifications',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: (error as Error).message
    };
  }
}

/**
 * Calculate overall status from components
 */
function calculateOverallStatus(components: ComponentHealth[]): ComponentStatus {
  const unhealthy = components.filter(c => c.status === 'unhealthy').length;
  const degraded = components.filter(c => c.status === 'degraded').length;
  
  if (unhealthy > 0) return 'unhealthy';
  if (degraded > 0) return 'degraded';
  return 'healthy';
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /api/health
 * Quick liveness check for load balancers
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';
  const metrics = searchParams.get('metrics') === 'true';
  
  // Quick check only
  if (!detailed && !metrics) {
    try {
      await getSupabase().from('agent_registry').select('count', { count: 'exact', head: true });
      
      return NextResponse.json({ status: 'ok', version: '0.25.0', latest_sdk_version: '0.25.0', latest_python_version: '0.25.0', min_supported_version: '0.20.0', timestamp: new Date().toISOString() }, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      return new Response('UNHEALTHY', { status: 503 });
    }
  }
  
  // Prometheus metrics endpoint
  if (metrics) {
    const components = await Promise.all([
      checkDatabase(),
      checkStripe(),
      checkBLS(),
      checkNotifications()
    ]);
    
    const lines: string[] = [];
    lines.push('# HELP moltos_health_status Component health status (0=unhealthy, 1=degraded, 2=healthy)');
    lines.push('# TYPE moltos_health_status gauge');
    
    components.forEach(c => {
      const statusValue = c.status === 'healthy' ? 2 : c.status === 'degraded' ? 1 : 0;
      lines.push(`moltos_health_status{component="${c.name}"} ${statusValue}`);
    });
    
    lines.push('# HELP moltos_health_response_time_ms Component response time in milliseconds');
    lines.push('# TYPE moltos_health_response_time_ms gauge');
    
    components.forEach(c => {
      lines.push(`moltos_health_response_time_ms{component="${c.name}"} ${c.responseTimeMs}`);
    });
    
    return new Response(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  // Detailed health report
  const components = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkBLS(),
    checkNotifications()
  ]);
  
  const status = calculateOverallStatus(components);
  
  const report: HealthReport = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: VERSION,
    components,
    summary: {
      healthy: components.filter(c => c.status === 'healthy').length,
      degraded: components.filter(c => c.status === 'degraded').length,
      unhealthy: components.filter(c => c.status === 'unhealthy').length
    }
  };
  
  return applySecurityHeaders(NextResponse.json(report, {
    status: status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache'
    }
  }));
}

/**
 * POST /api/health/webhook
 * Receive external health check pings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, status, message } = body;
    
    // Log external health events
    await getSupabase()
      .from('health_events')
      .insert([{
        source: source || 'unknown',
        status,
        message,
        created_at: new Date().toISOString()
      }]);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
// Deployed: Sat Mar 21 07:53:01 AM CST 2026
// Deployed: 2026-03-21T15:33:45Z
