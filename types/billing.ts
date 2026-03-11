/**
 * Billing & Subscription Types for MoltOS
 * Financial Infrastructure Types
 */

// ============================================================================
// Subscription Plans
// ============================================================================

export type SubscriptionTier = 'basic' | 'pro' | 'enterprise' | 'custom';
export type BillingInterval = 'monthly' | 'annual' | 'quarterly';
export type SubscriptionStatus = 
  | 'trialing' 
  | 'active' 
  | 'past_due' 
  | 'canceled' 
  | 'paused' 
  | 'incomplete';

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string;
  features: PlanFeature[];
  limits: PlanLimits;
  pricing: PlanPricing;
  trialDays: number;
  isPublic: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanLimits {
  agents: number;
  apiCalls: number;
  storageGB: number;
  computeHours: number;
  teamMembers: number;
  webhooks: number;
  integrations: number;
}

export interface PlanPricing {
  monthly: number;
  annual: number;
  quarterly?: number;
  currency: string;
  overageRates: OverageRates;
}

export interface OverageRates {
  apiCalls: number; // per 1000 calls
  storageGB: number; // per GB
  computeHours: number; // per hour
  agents: number; // per agent
}

// ============================================================================
// Subscriptions
// ============================================================================

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  usage: UsageMetrics;
  discounts: AppliedDiscount[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageMetrics {
  apiCalls: number;
  storageGB: number;
  computeHours: number;
  agents: number;
  lastUpdated: Date;
}

export interface AppliedDiscount {
  id: string;
  couponId?: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
}

// ============================================================================
// Invoicing
// ============================================================================

export type InvoiceStatus = 
  | 'draft' 
  | 'open' 
  | 'paid' 
  | 'uncollectible' 
  | 'void';

export type PaymentTerm = 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'due_on_receipt';

export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  paymentTerm: PaymentTerm;
  createdAt: Date;
  dueDate: Date;
  paidAt?: Date;
  voidedAt?: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  lateFees: number;
  pdfUrl?: string;
  metadata: Record<string, unknown>;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  proration: boolean;
  metadata?: Record<string, unknown>;
}

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  type: 'upcoming' | 'due_soon' | 'overdue' | 'final_notice';
  scheduledAt: Date;
  sentAt?: Date;
  status: 'pending' | 'sent' | 'failed';
}

// ============================================================================
// Tax Compliance
// ============================================================================

export type TaxRegion = 'us' | 'eu' | 'uk' | 'ca' | 'au' | 'global';

export interface TaxCalculation {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  country: string;
  postalCode?: string;
  taxAmount: number;
  taxRate: number;
  taxName: string;
  taxJurisdiction: string;
  breakdown: TaxBreakdown[];
}

export interface TaxBreakdown {
  jurisdiction: string;
  rate: number;
  amount: number;
  taxType: 'vat' | 'sales_tax' | 'gst' | 'hst' | 'other';
}

export interface Tax1099 {
  id: string;
  taxYear: number;
  payeeId: string;
  payeeName: string;
  payeeTin: string; // EIN or SSN (masked)
  address: Address;
  totalPayments: number;
  totalWithheld: number;
  transactions: number;
  status: 'draft' | 'filed' | 'corrected' | 'void';
  filedAt?: Date;
  irsCopyUrl?: string;
  recipientCopyUrl?: string;
}

export interface VATRecord {
  id: string;
  invoiceId: string;
  country: string;
  vatNumber?: string;
  vatRate: number;
  vatAmount: number;
  baseAmount: number;
  reverseCharge: boolean;
  intraCommunity: boolean;
  reported: boolean;
  reportedAt?: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

// ============================================================================
// Enterprise
// ============================================================================

export type SupportTier = 'standard' | 'priority' | 'dedicated';
export type SLALevel = 'standard' | 'enhanced' | 'premium';

export interface EnterpriseContract {
  id: string;
  customerId: string;
  contractNumber: string;
  status: 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  customTerms: CustomContractTerm[];
  volumeDiscounts: VolumeDiscount[];
  supportTier: SupportTier;
  slaLevel: SLALevel;
  slaGuarantees: SLAGuarantee[];
  dedicatedResources: DedicatedResource[];
  signedAt?: Date;
  signedBy?: string;
  documentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomContractTerm {
  id: string;
  section: string;
  description: string;
  value: string;
  legalReviewed: boolean;
}

export interface VolumeDiscount {
  id: string;
  metric: 'revenue' | 'usage' | 'seats' | 'api_calls';
  threshold: number;
  discountPercentage: number;
  discountFixed?: number;
  tier: number;
}

export interface SLAGuarantee {
  id: string;
  metric: 'uptime' | 'response_time' | 'resolution_time' | 'availability';
  target: number; // percentage or hours
  penalty: number; // percentage credit
  measurementWindow: 'monthly' | 'quarterly' | 'annual';
}

export interface DedicatedResource {
  id: string;
  type: 'account_manager' | 'technical_lead' | 'support_engineer' | 'sre';
  name: string;
  email: string;
  allocatedHours?: number;
}

// ============================================================================
// Financial Reporting
// ============================================================================

export interface PnLStatement {
  id: string;
  period: ReportingPeriod;
  revenue: RevenueBreakdown;
  costs: CostBreakdown;
  grossProfit: number;
  operatingExpenses: OperatingExpenses;
  netIncome: number;
  currency: string;
}

export interface ReportingPeriod {
  startDate: Date;
  endDate: Date;
  type: 'monthly' | 'quarterly' | 'annual';
}

export interface RevenueBreakdown {
  subscriptionRevenue: number;
  usageRevenue: number;
  enterpriseRevenue: number;
  totalRevenue: number;
  byPlan: Record<SubscriptionTier, number>;
  byRegion: Record<string, number>;
}

export interface CostBreakdown {
  infrastructure: number;
  paymentProcessing: number;
  support: number;
  sales: number;
  totalCOGS: number;
}

export interface OperatingExpenses {
  rAndD: number;
  marketing: number;
  gAndA: number;
  depreciation: number;
  totalOpEx: number;
}

export interface CashFlowStatement {
  id: string;
  period: ReportingPeriod;
  beginningCash: number;
  operatingActivities: CashFlowItem[];
  investingActivities: CashFlowItem[];
  financingActivities: CashFlowItem[];
  endingCash: number;
  currency: string;
}

export interface CashFlowItem {
  category: string;
  description: string;
  amount: number;
}

export interface RevenueRecognition {
  id: string;
  subscriptionId: string;
  invoiceId: string;
  totalAmount: number;
  recognizedAmount: number;
  deferredAmount: number;
  periodStart: Date;
  periodEnd: Date;
  recognitionSchedule: RecognitionEntry[];
}

export interface RecognitionEntry {
  month: string; // YYYY-MM
  amount: number;
  recognized: boolean;
  recognizedAt?: Date;
}

// ============================================================================
// QuickBooks Export
// ============================================================================

export interface QuickBooksExport {
  id: string;
  exportType: 'invoices' | 'revenue' | 'expenses' | 'journal_entries' | 'full_chart';
  period: ReportingPeriod;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  recordCount: number;
  qbCompanyId?: string;
  fileUrl?: string;
  errors?: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface QBJournalEntry {
  docNumber: string;
  txnDate: string;
  privateNote?: string;
  line: QBLineItem[];
}

export interface QBLineItem {
  description: string;
  amount: number;
  detailType: 'JournalEntryLineDetail';
  journalEntryLineDetail: {
    postingType: 'Debit' | 'Credit';
    accountRef: {
      name: string;
      value: string;
    };
  };
}
