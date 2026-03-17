/**
 * User Subscription API
 * GET: Get current user's subscription details
 * POST: Update subscription tier (mock)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser, 
  getCurrentSubscription, 
  TIER_CONFIG,
  type SubscriptionTier,
  getUpgradeInfo,
  hasAgentAccess,
  hasFeatureAccess,
} from '@/lib/auth';

// ============================================================================
// GET: Get Current User's Subscription
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Please sign in to access subscription details' 
          } 
        },
        { status: 401 }
      );
    }
    
    const subscription = user.subscription;
    const upgradeInfo = getUpgradeInfo(subscription.tier);
    
    // Calculate days remaining
    const expiresAt = new Date(subscription.expiresAt);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check agent access
    const agentAccess = {
      genesis: hasAgentAccess(subscription.tier, 'genesis'),
      support: hasAgentAccess(subscription.tier, 'support'),
      monitor: hasAgentAccess(subscription.tier, 'monitor'),
      trading: hasAgentAccess(subscription.tier, 'trading'),
    };
    
    // Check feature access
    const featureAccess = {
      readOnly: hasFeatureAccess(subscription.tier, 'read-only'),
      basicPrimitives: hasFeatureAccess(subscription.tier, 'basic-primitives'),
      advancedPrimitives: hasFeatureAccess(subscription.tier, 'advanced-primitives'),
      customPrimitives: hasFeatureAccess(subscription.tier, 'custom-primitives'),
      apiAccess: hasFeatureAccess(subscription.tier, 'api-access'),
      prioritySupport: hasFeatureAccess(subscription.tier, 'priority-support'),
      slaSupport: hasFeatureAccess(subscription.tier, 'sla-support'),
    };
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        subscription: {
          tier: subscription.tier,
          name: subscription.name,
          price: subscription.price,
          billingPeriod: subscription.billingPeriod,
          expiresAt: subscription.expiresAt,
          daysRemaining: Math.max(0, daysRemaining),
          isActive: daysRemaining > 0,
          features: subscription.features,
          limits: subscription.limits,
        },
        access: {
          agents: agentAccess,
          features: featureAccess,
        },
        upgrade: upgradeInfo.nextTier ? {
          available: true,
          nextTier: upgradeInfo.nextTier,
          tierName: TIER_CONFIG[upgradeInfo.nextTier].name,
          price: upgradeInfo.price,
          newFeatures: upgradeInfo.features,
        } : {
          available: false,
          message: 'You have the highest tier available',
        },
        allTiers: Object.entries(TIER_CONFIG).map(([key, config]) => ({
          id: key,
          name: config.name,
          price: config.price,
          features: config.features,
          limits: config.limits,
        })),
      },
    });
    
  } catch (error: any) {
    console.error('[Subscription API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'SUBSCRIPTION_ERROR', 
          message: error.message || 'Failed to get subscription details' 
        } 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Update Subscription Tier (Mock)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier } = body;
    
    const validTiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
    
    if (!tier || !validTiers.includes(tier)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_TIER', 
            message: `Invalid tier. Must be one of: ${validTiers.join(', ')}` 
          } 
        },
        { status: 400 }
      );
    }
    
    // In a real implementation, this would:
    // 1. Verify payment
    // 2. Update database
    // 3. Send confirmation email
    // 4. Update Stripe subscription
    
    // For mock, we just return success
    const tierKey = tier as SubscriptionTier;
    return NextResponse.json({
      success: true,
      data: {
        message: `Subscription updated to ${TIER_CONFIG[tierKey].name}`,
        tier,
        tierName: TIER_CONFIG[tierKey].name,
        price: TIER_CONFIG[tierKey].price,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[Subscription API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'UPDATE_ERROR', 
          message: error.message || 'Failed to update subscription' 
        } 
      },
      { status: 500 }
    );
  }
}
