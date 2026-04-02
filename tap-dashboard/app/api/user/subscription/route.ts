export const dynamic = 'force-dynamic';
/**
 * User Subscription API
 * GET: Get current user's subscription details (authenticated users)
 * POST: Update subscription tier (admin/service role only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security';
import { 
  getCurrentUser, 
  TIER_CONFIG,
  type SubscriptionTier,
  getUpgradeInfo,
  hasAgentAccess,
  hasFeatureAccess,
} from '@/lib/auth-subscription';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Rate limits
const MAX_BODY_SIZE_KB = 50;

// Service role key for admin operations
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Helper to verify service role authentication
function verifyServiceRole(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.replace('Bearer ', '');
  // Service role key is used for admin operations
  return token === SERVICE_ROLE_KEY;
}

// Helper to get service client
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase service role not configured');
  }
  
  return createTypedClient(url, key);
}

// ============================================================================
// GET: Get Current User's Subscription
// ============================================================================

export async function GET(request: NextRequest) {
  const path = '/api/user/subscription';
  
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Please sign in to access subscription details' 
          } 
        },
        { status: 401 }
      );
      return applySecurityHeaders(response);
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
    
    const response = NextResponse.json({
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
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
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
    
    return applySecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[Subscription API] Error:', error);
    const response = NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'SUBSCRIPTION_ERROR', 
          message: error.message || 'Failed to get subscription details' 
        } 
      },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}

// ============================================================================
// POST: Update Subscription Tier (Admin/Service Role Only)
// ============================================================================

export async function POST(request: NextRequest) {
  const path = '/api/user/subscription';
  
  const _rl = await applyRateLimit(request, path);
  if (_rl.response) return _rl.response;
  
  try {
    // Verify service role (admin only)
    if (!verifyServiceRole(request)) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Admin access required. Use service role key.' 
          } 
        },
        { status: 403 }
      );
      return applySecurityHeaders(response);
    }
    
    // Parse and validate body
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: sizeCheck.error } },
        { status: 413 }
      );
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    const { user_id, tier, reason } = body;
    
    // Validate required fields
    if (!user_id) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_USER_ID', 
            message: 'user_id is required' 
          } 
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    // Validate tier
    const validTiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
    if (!tier || !validTiers.includes(tier)) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_TIER', 
            message: `Invalid tier. Must be one of: ${validTiers.join(', ')}` 
          } 
        },
        { status: 400 }
      );
      return applySecurityHeaders(response);
    }
    
    // Update subscription in database
    const supabase = getServiceClient();
    
    // Get current subscription for audit log
    const { data: currentSub, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('tier, status')
      .eq('user_id', user_id)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[Subscription API] Error fetching current subscription:', fetchError);
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DATABASE_ERROR', 
            message: 'Failed to fetch current subscription' 
          } 
        },
        { status: 500 }
      );
      return applySecurityHeaders(response);
    }
    
    const previousTier = currentSub?.tier || 'starter';
    
    // Upsert subscription (update if exists, insert if not)
    const { data: updatedSub, error: updateError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id,
        tier,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 100 years for free tiers
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .maybeSingle();
    
    if (updateError) {
      console.error('[Subscription API] Error updating subscription:', updateError);
      const response = NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UPDATE_ERROR', 
            message: 'Failed to update subscription' 
          } 
        },
        { status: 500 }
      );
      return applySecurityHeaders(response);
    }
    
    // Log audit entry
    const { error: auditError } = await supabase
      .from('subscription_audit_log')
      .insert({
        user_id,
        action: 'tier_change',
        previous_tier: previousTier,
        new_tier: tier,
        reason: reason || 'Admin update',
        changed_at: new Date().toISOString(),
      });
    
    if (auditError) {
      // Non-fatal: log but don't fail the request
      console.warn('[Subscription API] Failed to create audit log:', auditError);
    }
    
    const tierKey = tier as SubscriptionTier;
    const response = NextResponse.json({
      success: true,
      data: {
        message: `Subscription updated to ${TIER_CONFIG[tierKey].name}`,
        user_id,
        previousTier,
        tier,
        tierName: TIER_CONFIG[tierKey].name,
        updatedAt: new Date().toISOString(),
      },
    });
    
    return applySecurityHeaders(response);
    
  } catch (error: any) {
    console.error('[Subscription API] Error:', error);
    const response = NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'UPDATE_ERROR', 
          message: error.message || 'Failed to update subscription' 
        } 
      },
      { status: 500 }
    );
    return applySecurityHeaders(response);
  }
}
