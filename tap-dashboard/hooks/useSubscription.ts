/**
 * useSubscription Hook
 * React hook for accessing subscription data and checking permissions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Subscription, 
  SubscriptionTier, 
  getClientSubscription,
  getClientUser,
  checkClientAgentAccess,
  checkClientFeatureAccess,
  meetsMinimumTier,
  getUpgradeInfo,
  setMockUser,
  clearAuth,
  TIER_CONFIG,
} from '@/lib/auth';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionState {
  subscription: Subscription;
  isLoading: boolean;
  error: string | null;
}

interface UseSubscriptionReturn {
  // State
  subscription: Subscription;
  tier: SubscriptionTier;
  isLoading: boolean;
  error: string | null;
  
  // Permission checks
  hasTier: (minTier: SubscriptionTier) => boolean;
  hasAgent: (agentType: string) => boolean;
  hasFeature: (feature: string) => boolean;
  
  // Upgrade info
  canUpgrade: boolean;
  nextTier: SubscriptionTier | null;
  upgradePrice: number;
  
  // Actions
  refresh: () => void;
  setTier: (tier: SubscriptionTier) => void;
  logout: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useSubscription(): UseSubscriptionReturn {
  const [state, setState] = useState<SubscriptionState>({
    subscription: getClientSubscription(),
    isLoading: true,
    error: null,
  });

  const refresh = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const subscription = getClientSubscription();
      setState({
        subscription,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load subscription',
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moltos_auth') {
        refresh();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refresh]);

  // Permission check callbacks
  const hasTier = useCallback((minTier: SubscriptionTier): boolean => {
    return meetsMinimumTier(state.subscription.tier, minTier);
  }, [state.subscription.tier]);

  const hasAgent = useCallback((agentType: string): boolean => {
    return checkClientAgentAccess(agentType);
  }, []);

  const hasFeature = useCallback((feature: string): boolean => {
    return checkClientFeatureAccess(feature);
  }, []);

  // Upgrade info
  const upgradeInfo = getUpgradeInfo(state.subscription.tier);

  // Actions
  const setTier = useCallback((tier: SubscriptionTier) => {
    setMockUser(`demo-${tier}`);
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    clearAuth();
    refresh();
  }, [refresh]);

  return {
    subscription: state.subscription,
    tier: state.subscription.tier,
    isLoading: state.isLoading,
    error: state.error,
    hasTier,
    hasAgent,
    hasFeature,
    canUpgrade: upgradeInfo.nextTier !== null,
    nextTier: upgradeInfo.nextTier,
    upgradePrice: upgradeInfo.price,
    refresh,
    setTier,
    logout,
  };
}

// ============================================================================
// Convenience Hooks for Specific Checks
// ============================================================================

/**
 * Hook specifically for Trading Agent access
 */
export function useTradingAgentAccess() {
  const { hasAgent, tier } = useSubscription();
  const hasAccess = hasAgent('trading');
  const upgradeInfo = getUpgradeInfo(tier);
  
  return {
    hasAccess,
    tier,
    requiredTier: 'pro' as const,
    canUpgrade: upgradeInfo.nextTier !== null && meetsMinimumTier(upgradeInfo.nextTier, 'pro'),
    upgradeToPro: upgradeInfo.nextTier === 'pro',
  };
}

/**
 * Hook for checking if user is on free tier
 */
export function useIsFreeTier() {
  const { tier } = useSubscription();
  return tier === 'starter';
}

/**
 * Hook for checking if user is on paid tier
 */
export function useIsPaidTier() {
  const { tier } = useSubscription();
  return tier !== 'starter';
}

/**
 * Hook for checking specific feature access with loading state
 */
export function useFeatureAccess(feature: string) {
  const { hasFeature, isLoading } = useSubscription();
  
  return {
    hasAccess: hasFeature(feature),
    isLoading,
  };
}

/**
 * Hook for checking agent access with loading state
 */
export function useAgentAccess(agentType: string) {
  const { hasAgent, isLoading, tier } = useSubscription();
  
  return {
    hasAccess: hasAgent(agentType),
    isLoading,
    tier,
    requiredTier: agentType === 'trading' ? 'pro' : 
                  agentType === 'support' || agentType === 'monitor' ? 'builder' : 'starter',
  };
}
