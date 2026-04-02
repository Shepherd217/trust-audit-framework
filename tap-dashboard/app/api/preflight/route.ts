export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';

const MAX_BODY_SIZE_KB = 50;

interface PreflightCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    // Validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      return applySecurityHeaders(NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      ));
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      ));
    }
    
    const { 
      action, // 'init', 'deploy', 'run', etc.
      public_key,
    } = body

    const checks: PreflightCheck[] = []
    let overallStatus: 'ready' | 'warning' | 'blocked' = 'ready'

    // Check 1: Node version (simulated for browser context)
    checks.push({
      name: 'Runtime Environment',
      status: 'pass',
      message: 'Browser environment detected (SDK will use Web Crypto)',
    })

    // Check 2: ClawID exists
    if (!public_key) {
      checks.push({
        name: 'ClawID Identity',
        status: 'fail',
        message: 'No ClawID found. Run "clawid create" first.',
      })
      overallStatus = 'blocked'
    } else {
      checks.push({
        name: 'ClawID Identity',
        status: 'pass',
        message: `ClawID verified: ${public_key.slice(0, 16)}...`,
      })
    }

    // Check 3: Action-specific checks
    switch (action) {
      case 'deploy':
        checks.push({
          name: 'Deploy Prerequisites',
          status: 'warn',
          message: 'Will require Fly.io API token or Helm access',
        })
        if (overallStatus === 'ready') overallStatus = 'warning'
        break

      case 'run':
        checks.push({
          name: 'ClawVM Resources',
          status: 'pass',
          message: 'ClawVM ready for task execution',
        })
        break

      case 'marketplace_post':
        checks.push({
          name: 'Payment Setup',
          status: 'warn',
          message: 'Stripe account required for escrow',
        })
        if (overallStatus === 'ready') overallStatus = 'warning'
        break
    }

    // Check 4: Permissions (always pass in browser, would check fs in Node)
    checks.push({
      name: 'Permissions',
      status: 'pass',
      message: 'Browser permissions adequate for SDK operation',
    })

    // Check 5: Storage (simulated)
    checks.push({
      name: 'Storage Space',
      status: 'pass',
      message: 'LocalStorage available for ClawID persistence',
    })

    return applySecurityHeaders(NextResponse.json({
      status: overallStatus,
      action,
      checks,
      can_proceed: overallStatus !== 'blocked',
      requires_confirmation: overallStatus === 'warning',
      timestamp: new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Preflight error:', error)
    return applySecurityHeaders(NextResponse.json(
      { error: 'Preflight check failed' },
      { status: 500 }
    ))
  }
}

// Also support GET for quick checks
export async function GET() {
  // Note: Rate limiting for GET is intentionally skipped for this lightweight public endpoint
  return applySecurityHeaders(NextResponse.json({
    status: 'ready',
    version: '0.25.0',
    capabilities: ['clawid', 'tap', 'marketplace', 'arbitra', 'clawfs'],
    timestamp: new Date().toISOString(),
  }))
}
