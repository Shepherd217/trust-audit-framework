/**
 * MoltOS Authentication & Subscription System
 * Mock auth system using localStorage/cookies for development
 */

import { cookies } from 'next/headers';

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
}

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: Subscription;
  createdAt: string;
}

// ============================================================================
// Tier Configuration
// ============================================================================

export const TIER_CONFIG: Record<SubscriptionTier, Omit<Subscription, 'expiresAt'>> = {
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
      'SLA guarantee',
      'Dedicated support',
      'White-label options',
      'On-premise deployment',
      'Audit logs',
    ],
    limits: {
      maxAgents: -1, // Unlimited
      maxPrimitives: -1, // Unlimited
      supportLevel: 'sla',
    },
  },
};

// ============================================================================
// Agent Access Mapping
// ============================================================================

export const AGENT_ACCESS: Record<string, SubscriptionTier[]> = {
  'genesis': ['starter', 'builder', 'pro', 'enterprise'],
  'support': ['builder', 'pro', 'enterprise'],
  'monitor': ['builder', 'pro', 'enterprise'],
  'trading': ['pro', 'enterprise'],
};

// ============================================================================
// Feature Access Mapping
// ============================================================================

export const FEATURE_ACCESS: Record<string, SubscriptionTier[]> = {
  'read-only': ['starter', 'builder', 'pro', 'enterprise'],
  'basic-primitives': ['builder', 'pro', 'enterprise'],
  'advanced-primitives': ['pro', 'enterprise'],
  'custom-primitives': ['enterprise'],
  'api-access': ['pro', 'enterprise'],
  'priority-support': ['pro', 'enterprise'],
  'sla-support': ['enterprise'],
};

// ============================================================================
// Tier Priority for Comparison
// ============================================================================

const TIER_PRIORITY: Record<SubscriptionTier, number> = {
  starter: 0,
  builder: 1,
  pro: 2,
  enterprise: 3,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a tier has access to a specific agent
 */
export function hasAgentAccess(tier: SubscriptionTier, agentType: string): boolean {
  const allowedTiers = AGENT_ACCESS[agentType.toLowerCase()];
  if (!allowedTiers) return false;
  return allowedTiers.includes(tier);
}

/**
 * Check if a tier has access to a specific feature
 */
export function hasFeatureAccess(tier: SubscriptionTier, feature: string): boolean {
  const allowedTiers = FEATURE_ACCESS[feature.toLowerCase()];
  if (!allowedTiers) return false;
  return allowedTiers.includes(tier);
}

/**
 * Check if user's tier meets the minimum required tier
 */
export function meetsMinimumTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_PRIORITY[userTier] >= TIER_PRIORITY[requiredTier];
}

/**
 * Get the next tier upgrade for a user
 */
export function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === tiers.length - 1) return null;
  return tiers[currentIndex + 1];
}

/**
 * Get upgrade path and pricing information
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
// Mock User Data (Server-Side)
// ============================================================================

const MOCK_USERS: Record<string, User> = {
  'demo-starter': {
    id: 'demo-starter',
    email: 'demo@starter.com',
    name: 'Demo Starter',
    subscription: {
      ...TIER_CONFIG.starter,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: new Date().toISOString(),
  },
  'demo-builder': {
    id: 'demo-builder',
    email: 'demo@builder.com',
    name: 'Demo Builder',
    subscription: {
      ...TIER_CONFIG.builder,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: new Date().toISOString(),
  },
  'demo-pro': {
    id: 'demo-pro',
    email: 'demo@pro.com',
    name: 'Demo Pro',
    subscription: {
      ...TIER_CONFIG.pro,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: new Date().toISOString(),
  },
  'demo-enterprise': {
    id: 'demo-enterprise',
    email: 'demo@enterprise.com',
    name: 'Demo Enterprise',
    subscription: {
      ...TIER_CONFIG.enterprise,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: new Date().toISOString(),
  },
};

// ============================================================================
// Server-Side Auth Functions
// ============================================================================

const AUTH_COOKIE_NAME = 'moltos_session';

/**
 * Get current user from cookies (Server-Side)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME);
    
    if (!sessionCookie?.value) {
      // Return default starter user for demo
      return MOCK_USERS['demo-starter'];
    }
    
    // Parse session from cookie
    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;
    
    if (!userId || !MOCK_USERS[userId]) {
      return MOCK_USERS['demo-starter'];
    }
    
    return MOCK_USERS[userId];
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return MOCK_USERS['demo-starter'];
  }
}

/**
 * Get current user's subscription (Server-Side)
 */
export async function getCurrentSubscription(): Promise<Subscription> {
  const user = await getCurrentUser();
  return user?.subscription || TIER_CONFIG.starter as Subscription;
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

const LOCAL_STORAGE_KEY = 'moltos_auth';

/**
 * Get user from localStorage (Client-Side)
 */
export function getClientUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return null;
    
    const session = JSON.parse(data);
    const userId = session.userId;
    
    if (!userId || !MOCK_USERS[userId]) return null;
    
    return MOCK_USERS[userId];
  } catch (error) {
    console.error('[Auth] Error getting client user:', error);
    return null;
  }
}

/**
 * Set mock user for testing (Client-Side)
 */
export function setMockUser(userId: keyof typeof MOCK_USERS): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ userId }));
  
  // Also set cookie for server-side auth
  document.cookie = `${AUTH_COOKIE_NAME}=${JSON.stringify({ userId })}; path=/; max-age=86400`;
}

/**
 * Clear auth session (Client-Side)
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
}

/**
 * Get client-side subscription
 */
export function getClientSubscription(): Subscription {
  const user = getClientUser();
  return user?.subscription || TIER_CONFIG.starter as Subscription;
}

/**
 * Check client-side feature access
 */
export function checkClientFeatureAccess(feature: string): boolean {
  const subscription = getClientSubscription();
  return hasFeatureAccess(subscription.tier, feature);
}

/**
 * Check client-side agent access
 */
export function checkClientAgentAccess(agentType: string): boolean {
  const subscription = getClientSubscription();
  return hasAgentAccess(subscription.tier, agentType);
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
  { path: '/primitives/advanced', requiredTier: 'pro', requiredFeature: 'advanced-primitives' },
  { path: '/primitives/custom', requiredTier: 'enterprise', requiredFeature: 'custom-primitives' },
  { path: '/api/trading', requiredTier: 'pro', requiredAgent: 'trading' },
  { path: '/settings/integrations', requiredTier: 'pro', requiredFeature: 'api-access' },
];

/**
 * Check if a path requires protection and get requirements
 */
export function getRouteProtection(path: string): RouteProtection | null {
  // Normalize path
  const normalizedPath = path.replace(/\/$/, '');
  
  // Find matching protection rule
  for (const rule of PROTECTED_ROUTES) {
    if (normalizedPath.startsWith(rule.path)) {
      return rule;
    }
  }
  
  return null;
}
