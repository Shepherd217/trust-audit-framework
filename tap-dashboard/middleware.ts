/**
 * MoltOS Middleware
 * Protects premium routes based on subscription tier
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { 
  SubscriptionTier, 
  getRouteProtection, 
  meetsMinimumTier,
  hasAgentAccess,
  hasFeatureAccess,
  TIER_PRIORITY,
  TIER_CONFIG,
} from './lib/auth';

// ============================================================================
// Configuration
// ============================================================================

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/pricing',
  '/about',
  '/contact',
  '/discover',
  '/moltos-story',
  '/api/auth',
  '/api/webhooks',
  '/api/stripe',
  '/api/health',
  '/api/pricing',
  '/_next',
  '/favicon.ico',
  '/static',
];

// Routes that require authentication but not specific tier
const AUTH_ONLY_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/api/user',
];

// API routes that should bypass tier checks (public APIs)
const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/pricing',
];

// Cookie name for auth session
const AUTH_COOKIE_NAME = 'moltos_session';

// Default tier for unauthenticated users (starter = free)
const DEFAULT_TIER: SubscriptionTier = 'starter';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a path is public
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => 
    path === route || path.startsWith(`${route}/`)
  ) || PUBLIC_API_ROUTES.some(route =>
    path === route || path.startsWith(`${route}/`)
  );
}

/**
 * Check if a path requires authentication only (no tier check)
 */
function isAuthOnlyRoute(path: string): boolean {
  return AUTH_ONLY_ROUTES.some(route =>
    path === route || path.startsWith(`${route}/`)
  );
}

/**
 * Extract tier from session cookie
 * Returns default tier if no valid session
 */
function getTierFromSession(request: NextRequest): SubscriptionTier {
  try {
    const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
    
    if (!sessionCookie?.value) {
      return DEFAULT_TIER;
    }
    
    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;
    
    // Extract tier from userId (demo-{tier} format)
    if (userId && userId.startsWith('demo-')) {
      const tier = userId.replace('demo-', '') as SubscriptionTier;
      if (TIER_PRIORITY[tier] !== undefined) {
        return tier;
      }
    }
    
    return DEFAULT_TIER;
  } catch (error) {
    console.error('[Middleware] Error parsing session:', error);
    return DEFAULT_TIER;
  }
}

/**
 * Build upgrade redirect URL with context
 */
function buildUpgradeUrl(request: NextRequest, requiredTier: SubscriptionTier): string {
  const currentUrl = encodeURIComponent(request.url);
  const tierName = TIER_CONFIG[requiredTier].name;
  return `/pricing?upgrade=${requiredTier}&from=${currentUrl}&required=${tierName}`;
}

/**
 * Build API error response
 */
function buildApiError(requiredTier: SubscriptionTier, feature?: string) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INSUFFICIENT_TIER',
        message: `This feature requires ${TIER_CONFIG[requiredTier].name} tier or higher`,
        requiredTier,
        feature,
        upgradeUrl: `/pricing?upgrade=${requiredTier}`,
      },
    },
    { 
      status: 403,
      headers: {
        'X-Subscription-Required': requiredTier,
      },
    }
  );
}

// ============================================================================
// Main Middleware Function
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Get user's current tier from session
  const userTier = getTierFromSession(request);
  
  // Check if route has specific protection rules
  const protection = getRouteProtection(pathname);
  
  if (protection) {
    // Check tier requirement
    if (protection.requiredTier) {
      if (!meetsMinimumTier(userTier, protection.requiredTier)) {
        // API routes return JSON error
        if (pathname.startsWith('/api/')) {
          return buildApiError(protection.requiredTier, protection.requiredFeature);
        }
        
        // Page routes redirect to upgrade page
        const upgradeUrl = buildUpgradeUrl(request, protection.requiredTier);
        return NextResponse.redirect(new URL(upgradeUrl, request.url));
      }
    }
    
    // Check agent access
    if (protection.requiredAgent) {
      if (!hasAgentAccess(userTier, protection.requiredAgent)) {
        if (pathname.startsWith('/api/')) {
          return buildApiError(protection.requiredTier || 'pro', protection.requiredAgent);
        }
        
        const upgradeUrl = buildUpgradeUrl(request, protection.requiredTier || 'pro');
        return NextResponse.redirect(new URL(upgradeUrl, request.url));
      }
    }
    
    // Check feature access
    if (protection.requiredFeature) {
      if (!hasFeatureAccess(userTier, protection.requiredFeature)) {
        if (pathname.startsWith('/api/')) {
          return buildApiError(protection.requiredTier || 'pro', protection.requiredFeature);
        }
        
        const upgradeUrl = buildUpgradeUrl(request, protection.requiredTier || 'pro');
        return NextResponse.redirect(new URL(upgradeUrl, request.url));
      }
    }
  }
  
  // For auth-only routes, we could add authentication check here
  // For now, we allow all (mock auth system)
  if (isAuthOnlyRoute(pathname)) {
    // In production, check if user is authenticated
    // For demo, we allow all
  }
  
  // Add tier header to all responses for client-side use
  const response = NextResponse.next();
  response.headers.set('X-User-Tier', userTier);
  response.headers.set('X-Tier-Priority', TIER_PRIORITY[userTier].toString());
  
  return response;
}

// ============================================================================
// Matcher Configuration
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - all static assets
     */
    '/((?!_next|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json)$).*)',
  ],
};
