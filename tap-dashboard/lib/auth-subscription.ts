/**
 * MoltOS Authentication & Subscription System
 * Real Supabase Auth integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// ============================================================================
// Subscription Tier Types
// ============================================================================

export type SubscriptionTier = 'starter' | 'builder' | 'pro' | 'enterprise';

export interface Subscription {
  tier: SubscriptionTier;
  name: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  expiresAt: string;
  features: string[];
  limits: {
    maxAgents: number;
    maxPrimitives: number;
    supportLevel: 'community' | 'email' | 'priority' | 'sla';
  };
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: Subscription;
  createdAt: string;
}

// Database row type
interface UserSubscriptionRow {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Tier Configuration
// ============================================================================

export const TIER_CONFIG: Record<SubscriptionTier, Omit<Subscription, 'expiresAt' | 'status'>> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    price: 0,
    billingPeriod: 'monthly',
    features: [
      'Genesis Agent access',
      'Read-only dashboard access',
      'Community support',
      'Basic analytics',
    ],
    limits: {
      maxAgents: 1,
      maxPrimitives: 3,
      supportLevel: 'community',
    },
  },
  builder: {
    tier: 'builder',
    name: 'Builder',
    price: 29,
    billingPeriod: 'monthly',
    features: [
      'Genesis Agent access',
      'Support Agent',
      'Monitor Agent',
      'Basic primitives library',
      'Email support',
      'Advanced analytics',
    ],
    limits: {
      maxAgents: 3,
      maxPrimitives: 10,
      supportLevel: 'email',
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 79,
    billingPeriod: 'monthly',
    features: [
      'All Builder features',
      'Trading Agent access',
      'Advanced primitives library',
      'Priority support',
      'Custom integrations',
      'API access',
      'Real-time analytics',
    ],
    limits: {
      maxAgents: 10,
      maxPrimitives: 50,
      supportLevel: 'priority',
    },
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    price: 199,
    billingPeriod: 'monthly',
    features: [
      'All Pro features',
      'Unlimited agents',
      'Custom primitives',
      'SLA support',
      'Dedicated infrastructure',
      'Custom contracts',
    ],
    limits: {
      maxAgents: 100,
      maxPrimitives: 1000,
      supportLevel: 'sla',
    },
  },
};

// Feature access by tier
const FEATURE_ACCESS: Record<SubscriptionTier, string[]> = {
  starter: ['read-only', 'basic-analytics'],
  builder: ['read-only', 'basic-analytics', 'basic-primitives', 'email-support', 'advanced-analytics'],
  pro: ['read-only', 'basic-analytics', 'basic-primitives', 'advanced-primitives', 'email-support', 'priority-support', 'advanced-analytics', 'api-access', 'custom-integrations'],
  enterprise: ['read-only', 'basic-analytics', 'basic-primitives', 'advanced-primitives', 'custom-primitives', 'email-support', 'priority-support', 'sla-support', 'advanced-analytics', 'api-access', 'custom-integrations', 'dedicated-infrastructure'],
};

// Agent access by tier
const AGENT_ACCESS: Record<SubscriptionTier, string[]> = {
  starter: ['genesis'],
  builder: ['genesis', 'support', 'monitor'],
  pro: ['genesis', 'support', 'monitor', 'trading'],
  enterprise: ['genesis', 'support', 'monitor', 'trading'],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert database row to Subscription object
 */
function rowToSubscription(row: UserSubscriptionRow): Subscription {
  const config = TIER_CONFIG[row.tier];
  const isActive = row.status === 'active' && 
    (!row.current_period_end || new Date(row.current_period_end) > new Date());
  
  return {
    ...config,
    tier: row.tier,
    status: isActive ? 'active' : row.status,
    expiresAt: row.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stripeCustomerId: row.stripe_customer_id || undefined,
    stripeSubscriptionId: row.stripe_subscription_id || undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}

/**
 * Get Supabase service role client (for server-side operations)
 */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  
  return createTypedClient(url, key);
}

/**
 * Check if a tier has access to a feature
 */
export function hasFeatureAccess(tier: SubscriptionTier, feature: string): boolean {
  return FEATURE_ACCESS[tier]?.includes(feature) ?? false;
}

/**
 * Check if a tier has access to an agent
 */
export function hasAgentAccess(tier: SubscriptionTier, agentType: string): boolean {
  return AGENT_ACCESS[tier]?.includes(agentType) ?? false;
}

/**
 * Get tier rank for comparison (higher = better)
 */
function getTierRank(tier: SubscriptionTier): number {
  const ranks: Record<SubscriptionTier, number> = {
    starter: 0,
    builder: 1,
    pro: 2,
    enterprise: 3,
  };
  return ranks[tier] ?? 0;
}

/**
 * Check if current tier meets minimum requirement
 */
export function meetsMinimumTier(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return getTierRank(currentTier) >= getTierRank(requiredTier);
}

/**
 * Get next tier upgrade
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
}

/**
 * Get upgrade info for a tier
 */
export function getUpgradeInfo(currentTier: SubscriptionTier): {
  nextTier: SubscriptionTier | null;
  price: number;
  features: string[];
} {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) {
    return { nextTier: null, price: 0, features: [] };
  }
  
  const config = TIER_CONFIG[nextTier];
  const currentConfig = TIER_CONFIG[currentTier];
  
  // Find new features compared to current tier
  const newFeatures = config.features.filter(
    f => !currentConfig.features.includes(f)
  );
  
  return {
    nextTier,
    price: config.price,
    features: newFeatures,
  };
}

// ============================================================================
// Server-Side Auth Functions
// ============================================================================

/**
 * Get current authenticated user from request (API Routes)
 * Use Bearer token from Authorization header
 */
export async function getAuthUserFromRequest(request: Request): Promise<{ user: User | null; error: string | null }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized - Bearer token required' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    return { user: null, error: 'Unauthorized - Invalid token' };
  }
  
  // Get subscription data
  const serviceClient = getServiceClient();
  const { data: subData, error: subError } = await serviceClient
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', authUser.id)
    .single();
  
  if (subError) {
    console.error('Error fetching subscription:', subError);
    // Return user with starter tier as fallback
    return {
      user: {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        subscription: {
          ...TIER_CONFIG.starter,
          status: 'active',
          expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: authUser.created_at || new Date().toISOString(),
      },
      error: null,
    };
  }
  
  const user: User = {
    id: authUser.id,
    email: authUser.email || '',
    name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
    subscription: rowToSubscription(subData as UserSubscriptionRow),
    createdAt: authUser.created_at || new Date().toISOString(),
  };
  
  return { user, error: null };
}

/**
 * Get current user (Server Components / API Routes with cookie auth)
 * Uses Supabase SSR approach compatible with Next.js 15
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    
    // Build auth token from cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Auth] Supabase environment variables not configured');
      return null;
    }
    
    // Extract auth token from cookies - Supabase stores it as sb-access-token
    const authCookie = cookieStore.get('sb-access-token') || cookieStore.get('supabase-auth-token');
    
    const supabase = createTypedClient(supabaseUrl, supabaseKey, {
      global: authCookie?.value ? {
        headers: { Authorization: `Bearer ${authCookie.value}` }
      } : undefined
    });
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return null;
    }
    
    // Get subscription data using service role
    const serviceClient = getServiceClient();
    const { data: subData, error: subError } = await serviceClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', authUser.id)
      .single();
    
    if (subError) {
      console.error('Error fetching subscription:', subError);
      // Return user with starter tier as fallback
      return {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        subscription: {
          ...TIER_CONFIG.starter,
          status: 'active',
          expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: authUser.created_at || new Date().toISOString(),
      };
    }
    
    return {
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      subscription: rowToSubscription(subData as UserSubscriptionRow),
      createdAt: authUser.created_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
}

/**
 * Get current user's subscription (Server-Side)
 */
export async function getCurrentSubscription(): Promise<Subscription> {
  const user = await getCurrentUser();
  return user?.subscription || { ...TIER_CONFIG.starter, status: 'active', expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() };
}

/**
 * Check if current user has access to a feature (Server-Side)
 */
export async function checkFeatureAccess(feature: string): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  return hasFeatureAccess(subscription.tier, feature);
}

/**
 * Check if current user can access an agent (Server-Side)
 */
export async function checkAgentAccess(agentType: string): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  return hasAgentAccess(subscription.tier, agentType);
}

/**
 * Require minimum tier, throws if not met (Server-Side)
 */
export async function requireMinimumTier(requiredTier: SubscriptionTier): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (!meetsMinimumTier(user.subscription.tier, requiredTier)) {
    throw new Error(`This feature requires ${TIER_CONFIG[requiredTier].name} tier or higher`);
  }
  
  return user;
}

// ============================================================================
// Client-Side Auth Functions
// ============================================================================

/**
 * Get Supabase client for client-side usage
 */
export function getClientSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON;
  
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  
  return createTypedClient(url, key);
}

/**
 * Get current user (Client-Side)
 */
export async function getClientUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const supabase = getClientSupabase();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return null;
    }
    
    // Get subscription data
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', authUser.id)
      .single();
    
    if (subError) {
      console.error('Error fetching subscription:', subError);
      return {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        subscription: {
          ...TIER_CONFIG.starter,
          status: 'active',
          expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: authUser.created_at || new Date().toISOString(),
      };
    }
    
    return {
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
      subscription: rowToSubscription(subData as UserSubscriptionRow),
      createdAt: authUser.created_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Auth] Error getting client user:', error);
    return null;
  }
}

/**
 * Get client-side subscription
 */
export async function getClientSubscription(): Promise<Subscription> {
  const user = await getClientUser();
  return user?.subscription || { ...TIER_CONFIG.starter, status: 'active', expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() };
}

/**
 * Check client-side feature access
 */
export async function checkClientFeatureAccess(feature: string): Promise<boolean> {
  const subscription = await getClientSubscription();
  return hasFeatureAccess(subscription.tier, feature);
}

/**
 * Check client-side agent access
 */
export async function checkClientAgentAccess(agentType: string): Promise<boolean> {
  const subscription = await getClientSubscription();
  return hasAgentAccess(subscription.tier, agentType);
}

// ============================================================================
// Legacy Mock Functions (Deprecated - for backward compatibility)
// ============================================================================

/** @deprecated Use getClientUser() instead */
export function setMockUser(userId: string): void {
  console.warn('[Auth] setMockUser is deprecated. User authentication is now handled by Supabase Auth.');
}

/** @deprecated Use supabase.auth.signOut() from @supabase/supabase-js instead */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  
  const supabase = getClientSupabase();
  supabase.auth.signOut();
}

// ============================================================================
// Route Protection Helpers
// ============================================================================

export interface RouteProtection {
  path: string;
  requiredTier: SubscriptionTier;
  requiredAgent?: string;
  requiredFeature?: string;
}

// Protected routes configuration
export const PROTECTED_ROUTES: RouteProtection[] = [
  { path: '/agent/trading', requiredTier: 'pro', requiredAgent: 'trading' },
  { path: '/agent/support', requiredTier: 'builder', requiredAgent: 'support' },
  { path: '/agent/monitor', requiredTier: 'builder', requiredAgent: 'monitor' },
  { path: '/api/claw/scheduler', requiredTier: 'builder' },
  { path: '/api/claw/vm/deploy', requiredTier: 'pro' },
];

/**
 * Check if a path requires protection and return requirements
 */
export function getRouteProtection(path: string): RouteProtection | null {
  return PROTECTED_ROUTES.find(route => path.startsWith(route.path)) || null;
}
