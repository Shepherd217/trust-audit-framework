/**
 * Micropayment Service for MoltOS
 * 
 * Pay-per-action billing system: pay for exactly what you use, not subscriptions.
 * Real-time billing accumulation with instant cost visibility.
 * 
 * Reference: Dieter Rams "Less but Better" - every charge must be justified,
 * visible, and fair. No hidden fees, no surprise bills.
 * 
 * @module lib/payments/micropayments
 */

import { createHash, randomUUID } from 'crypto';
import { stripe } from './stripe';

// ============================================================================
// TYPES
// ============================================================================

export type UsageAction = 
  | 'api_call'
  | 'token_input'
  | 'token_output'
  | 'compute_second'
  | 'task_completed'
  | 'task_failed'
  | 'storage_gb'
  | 'bandwidth_gb'
  | 'websocket_connection';

export type PricingModel = 'per_call' | 'per_token' | 'per_second' | 'outcome_based';

export interface UsageEvent {
  id: string;
  userId: string;
  agentId?: string;
  sessionId: string;
  action: UsageAction;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  billed: boolean;
  billingGroupId?: string;
}

export interface UsageSummary {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  currency: string;
  actionBreakdown: Record<UsageAction, {
    count: number;
    quantity: number;
    cost: number;
  }>;
  agentBreakdown: Record<string, {
    agentId: string;
    totalCost: number;
    actions: number;
  }>;
  dailyTrend: Array<{
    date: string;
    cost: number;
    actions: number;
  }>;
}

export interface UserBalance {
  userId: string;
  balance: number;
  currency: string;
  reserved: number;
  lifetimeSpent: number;
  lastUpdated: Date;
}

export interface AutoTopupConfig {
  enabled: boolean;
  threshold: number; // Charge when balance drops below this
  chargeAmount: number;
  maxMonthlyCharge: number;
  paymentMethodId: string;
  lastTopupAt?: Date;
  monthlyChargedThisMonth: number;
}

export interface CostProjection {
  currentMonthEstimate: number;
  nextMonthEstimate: number;
  dailyAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number; // 0-1
}

export interface RealtimeUsageStream {
  userId: string;
  currentSessionCost: number;
  currentDayCost: number;
  activeActions: number;
  lastEventAt: Date;
}

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

/**
 * Default pricing for MoltOS micropayments
 * These are configurable per-user or per-agent
 */
export const DEFAULT_PRICING: Record<UsageAction, { unitCost: number; unit: string; model: PricingModel }> = {
  api_call: {
    unitCost: 0.001, // $0.001 per API call
    unit: 'call',
    model: 'per_call',
  },
  token_input: {
    unitCost: 0.0001, // $0.0001 per token
    unit: 'token',
    model: 'per_token',
  },
  token_output: {
    unitCost: 0.0002, // $0.0002 per token (output costs more)
    unit: 'token',
    model: 'per_token',
  },
  compute_second: {
    unitCost: 0.000167, // $0.01 per minute = $0.000167 per second
    unit: 'second',
    model: 'per_second',
  },
  task_completed: {
    unitCost: 0.05, // $0.05 base per completed task
    unit: 'task',
    model: 'outcome_based',
  },
  task_failed: {
    unitCost: 0.005, // $0.005 per failed task (minimal charge for compute used)
    unit: 'task',
    model: 'outcome_based',
  },
  storage_gb: {
    unitCost: 0.023, // $0.023 per GB per month (S3 standard-like)
    unit: 'gb',
    model: 'per_second',
  },
  bandwidth_gb: {
    unitCost: 0.09, // $0.09 per GB egress
    unit: 'gb',
    model: 'per_call',
  },
  websocket_connection: {
    unitCost: 0.0001, // $0.0001 per minute of WebSocket connection
    unit: 'minute',
    model: 'per_second',
  },
};

// ============================================================================
// IN-MEMORY STORES (Replace with Redis/Database in production)
// ============================================================================

const usageEvents: Map<string, UsageEvent> = new Map();
const userBalances: Map<string, UserBalance> = new Map();
const autoTopupConfigs: Map<string, AutoTopupConfig> = new Map();
const activeSessions: Map<string, RealtimeUsageStream> = new Map();
const pricingOverrides: Map<string, Partial<Record<UsageAction, number>>> = new Map();

// WebSocket subscribers for real-time updates
const realtimeSubscribers: Map<string, Set<(event: UsageEvent) => void>> = new Map();

// ============================================================================
// CORE MICROPAYMENT FUNCTIONS
// ============================================================================

/**
 * Track a usage event and accumulate billing
 * 
 * @param userId - User performing the action
 * @param action - Type of action performed
 * @param quantity - Amount of the action (tokens, seconds, etc.)
 * @param metadata - Additional context
 * @returns The created usage event
 */
export async function trackUsage(
  userId: string,
  action: UsageAction,
  quantity: number,
  options: {
    agentId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    immediateBill?: boolean;
  } = {}
): Promise<UsageEvent> {
  const sessionId = options.sessionId || getCurrentSessionId(userId);
  const pricing = getPricingForUser(userId, action);
  const totalCost = Math.round(pricing.unitCost * quantity * 10000) / 10000; // 4 decimal precision

  const event: UsageEvent = {
    id: generateEventId(),
    userId,
    agentId: options.agentId,
    sessionId,
    action,
    quantity,
    unitCost: pricing.unitCost,
    totalCost,
    currency: 'USD',
    metadata: options.metadata,
    timestamp: new Date(),
    billed: false,
  };

  // Store event
  usageEvents.set(event.id, event);

  // Update real-time session tracking
  updateRealtimeStream(userId, event);

  // Check balance and trigger auto-topup if needed
  const balance = await getUserBalance(userId);
  const projectedBalance = balance.balance - totalCost;
  
  if (projectedBalance < 0) {
    throw new InsufficientBalanceError(
      `Insufficient balance. Required: $${totalCost.toFixed(4)}, Available: $${balance.balance.toFixed(4)}`,
      { required: totalCost, available: balance.balance }
    );
  }

  // Deduct from balance immediately for real-time billing
  await deductFromBalance(userId, totalCost);

  // Mark as billed
  event.billed = true;
  usageEvents.set(event.id, event);

  // Check auto-topup threshold
  const remainingBalance = balance.balance - totalCost;
  await checkAndTriggerAutoTopup(userId, remainingBalance);

  // Notify subscribers
  notifySubscribers(userId, event);

  return event;
}

/**
 * Get user's current balance
 */
export async function getUserBalance(userId: string): Promise<UserBalance> {
  let balance = userBalances.get(userId);
  
  if (!balance) {
    balance = {
      userId,
      balance: 0,
      currency: 'USD',
      reserved: 0,
      lifetimeSpent: 0,
      lastUpdated: new Date(),
    };
    userBalances.set(userId, balance);
  }
  
  return { ...balance };
}

/**
 * Add funds to user balance
 */
export async function addToBalance(
  userId: string,
  amount: number,
  source: 'stripe' | 'crypto' | 'refund' | 'bonus',
  sourceRef?: string
): Promise<UserBalance> {
  const balance = await getUserBalance(userId);
  
  balance.balance += amount;
  balance.lastUpdated = new Date();
  
  userBalances.set(userId, balance);
  
  // Log the deposit
  console.log(`[Micropayments] Added $${amount.toFixed(4)} to ${userId} via ${source}`, { sourceRef });
  
  return { ...balance };
}

/**
 * Deduct from user balance
 */
async function deductFromBalance(userId: string, amount: number): Promise<void> {
  const balance = await getUserBalance(userId);
  
  balance.balance -= amount;
  balance.lifetimeSpent += amount;
  balance.lastUpdated = new Date();
  
  userBalances.set(userId, balance);
}

/**
 * Reserve funds for an upcoming operation (pre-auth style)
 */
export async function reserveFunds(
  userId: string,
  amount: number,
  operationId: string
): Promise<{ success: boolean; reservationId?: string }> {
  const balance = await getUserBalance(userId);
  const available = balance.balance - balance.reserved;
  
  if (available < amount) {
    return { success: false };
  }
  
  balance.reserved += amount;
  userBalances.set(userId, balance);
  
  return { success: true, reservationId: operationId };
}

/**
 * Release reserved funds
 */
export async function releaseReservation(
  userId: string,
  reservationId: string,
  actualCost?: number
): Promise<void> {
  const balance = await getUserBalance(userId);
  // In production, lookup actual reservation amount
  balance.reserved = Math.max(0, balance.reserved - (actualCost || 0));
  userBalances.set(userId, balance);
}

// ============================================================================
// USAGE SUMMARY & ANALYTICS
// ============================================================================

/**
 * Get usage summary for a billing period
 */
export async function getUsageSummary(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageSummary> {
  const events = Array.from(usageEvents.values()).filter(
    e => e.userId === userId &&
         e.timestamp >= startDate &&
         e.timestamp <= endDate
  );
  
  // Action breakdown
  const actionBreakdown: UsageSummary['actionBreakdown'] = {} as any;
  for (const action of Object.keys(DEFAULT_PRICING) as UsageAction[]) {
    const actionEvents = events.filter(e => e.action === action);
    actionBreakdown[action] = {
      count: actionEvents.length,
      quantity: actionEvents.reduce((sum, e) => sum + e.quantity, 0),
      cost: actionEvents.reduce((sum, e) => sum + e.totalCost, 0),
    };
  }
  
  // Agent breakdown
  const agentMap = new Map<string, { agentId: string; totalCost: number; actions: number }>();
  for (const event of events) {
    if (event.agentId) {
      const existing = agentMap.get(event.agentId) || { agentId: event.agentId, totalCost: 0, actions: 0 };
      existing.totalCost += event.totalCost;
      existing.actions += 1;
      agentMap.set(event.agentId, existing);
    }
  }
  
  // Daily trend
  const dailyMap = new Map<string, { cost: number; actions: number }>();
  for (const event of events) {
    const date = event.timestamp.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { cost: 0, actions: 0 };
    existing.cost += event.totalCost;
    existing.actions += 1;
    dailyMap.set(date, existing);
  }
  
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    userId,
    period: { start: startDate, end: endDate },
    totalCost: events.reduce((sum, e) => sum + e.totalCost, 0),
    currency: 'USD',
    actionBreakdown,
    agentBreakdown: Object.fromEntries(agentMap),
    dailyTrend,
  };
}

/**
 * Get current session's real-time cost
 */
export function getSessionCost(userId: string, sessionId?: string): number {
  const sid = sessionId || getCurrentSessionId(userId);
  const stream = activeSessions.get(`${userId}:${sid}`);
  return stream?.currentSessionCost || 0;
}

/**
 * Get real-time usage stream
 */
export function getRealtimeStream(userId: string): RealtimeUsageStream | null {
  // Find most recent session
  let mostRecent: RealtimeUsageStream | null = null;
  
  for (const [key, stream] of activeSessions) {
    if (key.startsWith(`${userId}:`)) {
      if (!mostRecent || stream.lastEventAt > mostRecent.lastEventAt) {
        mostRecent = stream;
      }
    }
  }
  
  return mostRecent;
}

// ============================================================================
// AUTO-TOPUP SYSTEM
// ============================================================================

/**
 * Configure auto-topup for a user
 */
export async function configureAutoTopup(
  userId: string,
  config: Partial<AutoTopupConfig>
): Promise<AutoTopupConfig> {
  const existing = autoTopupConfigs.get(userId) || {
    enabled: false,
    threshold: 5.00,
    chargeAmount: 20.00,
    maxMonthlyCharge: 100.00,
    paymentMethodId: '',
    monthlyChargedThisMonth: 0,
  };
  
  const updated = { ...existing, ...config };
  autoTopupConfigs.set(userId, updated);
  
  return { ...updated };
}

/**
 * Check balance and trigger auto-topup if needed
 */
async function checkAndTriggerAutoTopup(userId: string, currentBalance: number): Promise<void> {
  const config = autoTopupConfigs.get(userId);
  
  if (!config || !config.enabled) return;
  if (currentBalance >= config.threshold) return;
  
  // Check monthly limit
  const now = new Date();
  const lastTopup = config.lastTopupAt;
  
  // Reset monthly counter if it's a new month
  if (lastTopup && lastTopup.getMonth() !== now.getMonth()) {
    config.monthlyChargedThisMonth = 0;
  }
  
  if (config.monthlyChargedThisMonth + config.chargeAmount > config.maxMonthlyCharge) {
    console.log(`[Micropayments] Monthly auto-topup limit reached for ${userId}`);
    return;
  }
  
  // Trigger topup via Stripe
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(config.chargeAmount * 100),
      currency: 'usd',
      customer: userId, // In production, map to Stripe customer ID
      payment_method: config.paymentMethodId,
      off_session: true,
      confirm: true,
      description: `MoltOS Auto-Topup - Balance below $${config.threshold}`,
      metadata: {
        type: 'auto_topup',
        userId,
        triggeredAt: currentBalance.toFixed(4),
      },
    });
    
    if (paymentIntent.status === 'succeeded') {
      await addToBalance(userId, config.chargeAmount, 'stripe', paymentIntent.id);
      
      config.lastTopupAt = new Date();
      config.monthlyChargedThisMonth += config.chargeAmount;
      autoTopupConfigs.set(userId, config);
      
      console.log(`[Micropayments] Auto-topup successful: $${config.chargeAmount} for ${userId}`);
    }
  } catch (error) {
    console.error(`[Micropayments] Auto-topup failed for ${userId}:`, error);
    // In production: notify user, alert admins
  }
}

// ============================================================================
// COST PROJECTIONS
// ============================================================================

/**
 * Calculate cost projections based on usage patterns
 */
export async function calculateCostProjection(userId: string): Promise<CostProjection> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  // Get last 30 days
  const recentSummary = await getUsageSummary(userId, thirtyDaysAgo, now);
  
  // Get previous 30 days for trend
  const previousSummary = await getUsageSummary(userId, sixtyDaysAgo, thirtyDaysAgo);
  
  const recentDaily = recentSummary.totalCost / 30;
  const previousDaily = previousSummary.totalCost / 30;
  
  // Determine trend
  let trend: CostProjection['trend'] = 'stable';
  const changePercent = previousDaily > 0 ? (recentDaily - previousDaily) / previousDaily : 0;
  
  if (changePercent > 0.1) trend = 'increasing';
  else if (changePercent < -0.1) trend = 'decreasing';
  
  // Calculate confidence based on data consistency
  const dailyCosts = recentSummary.dailyTrend.map(d => d.cost);
  const variance = calculateVariance(dailyCosts);
  const confidence = Math.max(0, 1 - (variance / (recentDaily || 1)));
  
  // Days remaining in month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  
  const currentMonthEstimate = recentSummary.totalCost + (recentDaily * daysRemaining);
  const nextMonthEstimate = recentDaily * daysInMonth;
  
  return {
    currentMonthEstimate: Math.round(currentMonthEstimate * 100) / 100,
    nextMonthEstimate: Math.round(nextMonthEstimate * 100) / 100,
    dailyAverage: Math.round(recentDaily * 100) / 100,
    trend,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ============================================================================
// PRICING MANAGEMENT
// ============================================================================

/**
 * Set custom pricing for a user
 */
export function setUserPricing(
  userId: string,
  action: UsageAction,
  unitCost: number
): void {
  const existing = pricingOverrides.get(userId) || {};
  existing[action] = unitCost;
  pricingOverrides.set(userId, existing);
}

/**
 * Get pricing for a user (with override support)
 */
function getPricingForUser(userId: string, action: UsageAction) {
  const override = pricingOverrides.get(userId)?.[action];
  
  if (override !== undefined) {
    return { ...DEFAULT_PRICING[action], unitCost: override };
  }
  
  return DEFAULT_PRICING[action];
}

/**
 * Calculate cost for an action
 */
export function calculateCost(action: UsageAction, quantity: number): number {
  const pricing = DEFAULT_PRICING[action];
  return Math.round(pricing.unitCost * quantity * 10000) / 10000;
}

// ============================================================================
// REAL-TIME WEBSOCKET SUPPORT
// ============================================================================

/**
 * Subscribe to real-time usage updates
 */
export function subscribeToUsage(
  userId: string,
  callback: (event: UsageEvent) => void
): () => void {
  let subscribers = realtimeSubscribers.get(userId);
  
  if (!subscribers) {
    subscribers = new Set();
    realtimeSubscribers.set(userId, subscribers);
  }
  
  subscribers.add(callback);
  
  // Return unsubscribe function
  return () => {
    subscribers?.delete(callback);
  };
}

function notifySubscribers(userId: string, event: UsageEvent): void {
  const subscribers = realtimeSubscribers.get(userId);
  if (!subscribers) return;
  
  for (const callback of subscribers) {
    try {
      callback(event);
    } catch (error) {
      console.error('[Micropayments] Error notifying subscriber:', error);
    }
  }
}

function updateRealtimeStream(userId: string, event: UsageEvent): void {
  const key = `${userId}:${event.sessionId}`;
  let stream = activeSessions.get(key);
  
  if (!stream) {
    stream = {
      userId,
      currentSessionCost: 0,
      currentDayCost: 0,
      activeActions: 0,
      lastEventAt: new Date(),
    };
  }
  
  stream.currentSessionCost += event.totalCost;
  
  // Reset daily cost if it's a new day
  const now = new Date();
  const lastEvent = stream.lastEventAt;
  if (now.getDate() !== lastEvent.getDate() || now.getMonth() !== lastEvent.getMonth()) {
    stream.currentDayCost = 0;
  }
  stream.currentDayCost += event.totalCost;
  
  stream.activeActions += 1;
  stream.lastEventAt = now;
  
  activeSessions.set(key, stream);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateEventId(): string {
  return `evt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function getCurrentSessionId(userId: string): string {
  // In production, this would be from the request context
  return `sess_${Date.now()}_${userId.slice(0, 8)}`;
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

export class InsufficientBalanceError extends Error {
  constructor(
    message: string,
    public details: { required: number; available: number }
  ) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class MicropaymentError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'MicropaymentError';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const MicropaymentService = {
  trackUsage,
  getUserBalance,
  addToBalance,
  reserveFunds,
  releaseReservation,
  getUsageSummary,
  getSessionCost,
  getRealtimeStream,
  configureAutoTopup,
  calculateCostProjection,
  setUserPricing,
  calculateCost,
  subscribeToUsage,
  DEFAULT_PRICING,
};

export default MicropaymentService;