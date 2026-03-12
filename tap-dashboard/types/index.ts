/**
 * Shared Types for TAP Dashboard
 * Reputation-Based Pricing Types
 */

// Reputation Tiers
export type ReputationTier = 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

// Tier Configuration
export interface TierConfig {
  name: ReputationTier;
  minScore: number;
  maxScore: number;
  multiplier: number;
  description: string;
  benefits: string[];
}

// Agent Performance Metrics
export interface AgentMetrics {
  tasksCompleted: number;
  tasksAssigned: number;
  errors: number;
  totalActions: number;
  avgResponseTimeMs: number;
  baselineResponseTimeMs: number;
}

// Reputation Score Details
export interface ReputationScore {
  score: number;
  completionRate: number;
  accuracyScore: number;
  responseTimeScore: number;
  breakdown: {
    completionContribution: number;
    accuracyContribution: number;
    responseTimeContribution: number;
  };
}

// Pricing Factors
export interface PricingFactors {
  complexity: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'normal' | 'high' | 'urgent' | 'emergency';
}

// Price Quote Response
export interface PriceQuote {
  agentId: string;
  basePrice: number;
  finalPrice: number;
  multiplier: number;
  tier: ReputationTier;
  breakdown: {
    basePrice: number;
    tierMultiplier: number;
    tierDiscount: number;
    complexityFactor: number;
    complexityPremium: number;
    urgencyFactor: number;
    urgencyPremium: number;
  };
  reputation: {
    score: number;
    tier: ReputationTier;
    nextTier?: ReputationTier;
    pointsToNextTier?: number;
  };
}

// Agent Reputation Record
export interface AgentReputationRecord {
  agentId: string;
  score: number;
  tier: ReputationTier;
  metrics: AgentMetrics;
  history: {
    score: number;
    tier: ReputationTier;
    timestamp: string;
  }[];
  updatedAt: string;
}

// Reputation Sync Result
export interface ReputationSyncResult {
  agentId: string;
  previousScore: number;
  newScore: number;
  tier: ReputationTier;
  previousTier?: ReputationTier;
  tierChanged: boolean;
  metrics: {
    completionRate: number;
    accuracyScore: number;
    responseTimeScore: number;
  };
  breakdown: {
    completionContribution: number;
    accuracyContribution: number;
    responseTimeContribution: number;
  };
  progressToNextTier?: {
    nextTier: ReputationTier;
    pointsNeeded: number;
    percentage: number;
  };
}

// API Response Types
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// Subscription Types
// ============================================================================

export type SubscriptionTier = 'starter' | 'builder' | 'pro' | 'enterprise';

export interface SubscriptionLimits {
  maxAgents: number;
  maxPrimitives: number;
  supportLevel: 'community' | 'email' | 'priority' | 'sla';
}

export interface Subscription {
  tier: SubscriptionTier;
  name: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  expiresAt: string;
  features: string[];
  limits: SubscriptionLimits;
}

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: Subscription;
  createdAt: string;
}

export interface SubscriptionResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  subscription: {
    tier: SubscriptionTier;
    name: string;
    price: number;
    billingPeriod: 'monthly' | 'yearly';
    expiresAt: string;
    daysRemaining: number;
    isActive: boolean;
    features: string[];
    limits: SubscriptionLimits;
  };
  access: {
    agents: {
      genesis: boolean;
      support: boolean;
      monitor: boolean;
      trading: boolean;
    };
    features: {
      readOnly: boolean;
      basicPrimitives: boolean;
      advancedPrimitives: boolean;
      customPrimitives: boolean;
      apiAccess: boolean;
      prioritySupport: boolean;
      slaSupport: boolean;
    };
  };
  upgrade: {
    available: boolean;
    nextTier?: SubscriptionTier;
    tierName?: string;
    price?: number;
    newFeatures?: string[];
    message?: string;
  };
  allTiers: Array<{
    id: SubscriptionTier;
    name: string;
    price: number;
    features: string[];
    limits: SubscriptionLimits;
  }>;
}