/**
 * ClawOS Payment Types
 * TypeScript definitions for escrow, payment, and dispute entities
 * @module types/payments
 */

// =====================================================
// ENUMS
// =====================================================

/**
 * Escrow lifecycle states
 * pending → funded → in_progress → completed|disputed
 */
export enum EscrowStatus {
    PENDING = 'pending',
    FUNDED = 'funded',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    DISPUTED = 'disputed',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
}

/**
 * Payment processing states
 */
export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}

/**
 * Supported payment methods
 */
export enum PaymentMethod {
    CRYPTO = 'crypto',
    STRIPE = 'stripe',
    BANK_TRANSFER = 'bank_transfer',
    CLAW_CREDIT = 'claw_credit',
}

/**
 * Dispute lifecycle states
 */
export enum DisputeStatus {
    OPEN = 'open',
    EVIDENCE = 'evidence',
    VOTING = 'voting',
    RESOLVED = 'resolved',
    APPEALED = 'appealed',
}

/**
 * Dispute resolution outcomes
 */
export enum DisputeResolution {
    PENDING = 'pending',
    PAYER_WINS = 'payer_wins',
    PAYEE_WINS = 'payee_wins',
    SPLIT = 'split',
    ESCROWED = 'escrowed',
}

/**
 * User role in an escrow
 */
export enum EscrowRole {
    CREATOR = 'creator',
    PAYER = 'payer',
    PAYEE = 'payee',
}

// =====================================================
// CORE INTERFACES
// =====================================================

/**
 * Escrow contract between payer and payee
 */
export interface Escrow {
    /** Unique identifier */
    id: string;
    
    /** ClawID of the escrow creator */
    clawId: string;
    
    /** ClawID of the party paying funds */
    payerClawId: string;
    
    /** ClawID of the party receiving funds */
    payeeClawId: string;
    
    /** Optional: Linked ClawLink handoff ID */
    handoffId?: string;
    
    /** Escrow amount in smallest unit */
    amount: number;
    
    /** Currency code (ETH, USDC, USD, etc.) */
    currency: string;
    
    /** Description of what the escrow is for */
    description?: string;
    
    /** Current state in the lifecycle */
    status: EscrowStatus;
    
    /** Number of milestones (1 for simple escrows) */
    milestoneCount: number;
    
    /** Current milestone index (0-based) */
    currentMilestone: number;
    
    /** When escrow was created */
    createdAt: Date;
    
    /** When escrow was funded */
    fundedAt?: Date;
    
    /** When work/service started */
    startedAt?: Date;
    
    /** When escrow completed */
    completedAt?: Date;
    
    /** Auto-cancel deadline if not funded */
    expiresAt?: Date;
    
    /** ID of active dispute if any */
    activeDisputeId?: string;
    
    /** Total number of disputes raised */
    disputeCount: number;
    
    /** Additional metadata */
    metadata: Record<string, unknown>;
}

/**
 * Payment transaction record
 */
export interface Payment {
    /** Unique identifier */
    id: string;
    
    /** Linked escrow ID (if escrow payment) */
    escrowId?: string;
    
    /** ClawID of payment initiator */
    clawId: string;
    
    /** Payment amount */
    amount: number;
    
    /** Currency code */
    currency: string;
    
    /** Payment method used */
    method: PaymentMethod;
    
    /** Current payment status */
    status: PaymentStatus;
    
    /** Blockchain transaction hash (for crypto) */
    txHash?: string;
    
    /** Stripe payment intent ID */
    stripePaymentIntentId?: string;
    
    /** External reference (bank transfer, etc.) */
    externalRef?: string;
    
    /** When payment was created */
    createdAt: Date;
    
    /** When payment was processed */
    processedAt?: Date;
    
    /** ClawOS platform fee */
    platformFee: number;
    
    /** Processing fees (Stripe, gas, etc.) */
    processingFee: number;
    
    /** Additional metadata */
    metadata: Record<string, unknown>;
}

/**
 * Dispute case for Arbitra resolution
 */
export interface Dispute {
    /** Unique identifier */
    id: string;
    
    /** Linked escrow ID */
    escrowId: string;
    
    /** ClawID of dispute initiator */
    initiatorClawId: string;
    
    /** ClawID of other party */
    respondentClawId: string;
    
    /** Reason for raising dispute */
    reason: string;
    
    /** Evidence URLs */
    evidenceUrls: string[];
    
    /** Committee size (default 7) */
    committeeSize: number;
    
    /** Selected committee member ClawIDs */
    committeeMembers: string[];
    
    /** Votes in favor of payer */
    votesForPayer: number;
    
    /** Votes in favor of payee */
    votesForPayee: number;
    
    /** Current dispute status */
    status: DisputeStatus;
    
    /** Resolution outcome */
    resolution: DisputeResolution;
    
    /** Explanation of resolution */
    resolutionNotes?: string;
    
    /** Who/what resolved the dispute */
    resolvedBy?: string;
    
    /** When dispute was resolved */
    resolvedAt?: Date;
    
    /** When dispute was created */
    createdAt: Date;
    
    /** Deadline for evidence submission */
    evidenceDeadline?: Date;
    
    /** Deadline for committee voting */
    votingDeadline?: Date;
    
    /** Committee members slashed for bias */
    slashedMembers: string[];
    
    /** Reasons for slashing */
    slashReasons: string[];
    
    /** Additional metadata */
    metadata: Record<string, unknown>;
}

/**
 * Milestone within a multi-stage escrow
 */
export interface EscrowMilestone {
    /** Unique identifier */
    id: string;
    
    /** Parent escrow ID */
    escrowId: string;
    
    /** Milestone index (0-based) */
    milestoneIndex: number;
    
    /** Milestone title */
    title: string;
    
    /** Milestone description */
    description?: string;
    
    /** Amount allocated to this milestone */
    amount: number;
    
    /** Current milestone status */
    status: EscrowStatus;
    
    /** When milestone was created */
    createdAt: Date;
    
    /** When milestone was completed */
    completedAt?: Date;
}

// =====================================================
// REQUEST/CREATE INTERFACES
// =====================================================

/**
 * Request to create a new escrow
 */
export interface CreateEscrowRequest {
    /** Payer's ClawID */
    payerClawId: string;
    
    /** Payee's ClawID */
    payeeClawId: string;
    
    /** Escrow amount */
    amount: number;
    
    /** Currency code */
    currency: string;
    
    /** What the escrow is for */
    description?: string;
    
    /** Optional linked handoff ID */
    handoffId?: string;
    
    /** Number of milestones (default 1) */
    milestoneCount?: number;
    
    /** Expiry time from now (hours) */
    expiresInHours?: number;
    
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Request to create a Stripe payment intent
 */
export interface CreatePaymentIntentRequest {
    /** Payment amount */
    amount: number;
    
    /** Currency code (usd, eur, etc.) */
    currency: string;
    
    /** Task ID this payment is for */
    taskId: string;
    
    /** Agent ID receiving payment */
    agentId: string;
    
    /** Customer ID making payment */
    customerId: string;
    
    /** Optional description */
    description?: string;
    
    /** Whether to hold funds in escrow */
    holdInEscrow?: boolean;
    
    /** Whether escrow is enabled for this payment */
    escrowEnabled?: boolean;
    
    /** Platform fee percentage (default 2.5%) */
    platformFeePercent?: number;
    
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
export interface FundEscrowRequest {
    /** Escrow ID to fund */
    escrowId: string;
    
    /** Payment method to use */
    method: PaymentMethod;
    
    /** For crypto: wallet address */
    walletAddress?: string;
    
    /** For Stripe: payment method ID */
    paymentMethodId?: string;
}

/**
 * Request to capture a payment (for Stripe holds)
 */
export interface CapturePaymentRequest {
    /** Payment intent ID to capture */
    paymentIntentId: string;
    
    /** Amount to capture (if partial capture) */
    amount?: number;
    
    /** Optional capture notes */
    notes?: string;
}

/**
 * Request to refund a payment
 */
export interface RefundPaymentRequest {
    /** Payment intent ID to refund */
    paymentIntentId: string;
    
    /** Amount to refund (if partial refund) */
    amount?: number;
    
    /** Refund reason */
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge';
}

// =====================================================
// RESPONSE INTERFACES
// =====================================================

/**
 * Response from creating a payment intent
 */
export interface CreatePaymentIntentResponse {
    /** Client secret for Stripe.js */
    clientSecret: string;
    
    /** Payment intent ID */
    paymentIntentId: string;
    
    /** Payment status */
    status: string;
    
    /** Amount in cents */
    amount: number;
    
    /** Currency code */
    currency: string;
}

/**
 * Response from capturing a payment
 */
export interface CapturePaymentResponse {
    /** Success status */
    success: boolean;
    
    /** Payment intent ID */
    paymentIntentId: string;
    
    /** Captured amount */
    amountCaptured: number;
    
    /** Payment status */
    status: string;
}

/**
 * Response from refunding a payment
 */
export interface RefundPaymentResponse {
    /** Success status */
    success: boolean;
    
    /** Refund ID */
    refundId: string;
    
    /** Refunded amount */
    amountRefunded: number;
    
    /** Refund status */
    status: string;
}

/**
 * Request to create a connected account
 */
export interface ConnectedAccountRequest {
    /** Agent ClawID (optional if passed in metadata) */
    clawId?: string;
    
    /** Account type (standard, express, custom) */
    accountType?: 'standard' | 'express' | 'custom';
    
    /** Country code */
    country?: string;
    
    /** Email address */
    email?: string;
    
    /** Business type (individual, company) */
    businessType?: 'individual' | 'company';
    
    /** Additional metadata (string values only for Stripe) */
    metadata?: Record<string, string>;
}

/**
 * Response from creating a connected account
 */
export interface ConnectedAccountResponse {
    /** Connected account ID */
    accountId: string;
    
    /** Onboarding URL (for express/custom) */
    onboardingUrl?: string;
    
    /** Account status */
    status: string;
    
    /** Account requirements */
    requirements?: {
        currentlyDue: string[];
        eventuallyDue: string[];
        pastDue: string[];
        pendingVerification: string[];
    };
    
    /** Whether charges are enabled */
    chargesEnabled?: boolean;
    
    /** Whether payouts are enabled */
    payoutsEnabled?: boolean;
}

/**
 * Request to transfer funds
 */
export interface TransferRequest {
    /** Connected account ID to transfer to */
    destinationAccountId: string;
    
    /** Transfer amount in cents */
    amount: number;
    
    /** Currency code */
    currency?: string;
    
    /** Transfer description */
    description?: string;
    
    /** Associated payment intent ID */
    paymentIntentId?: string;
}

/**
 * Response from transferring funds
 */
export interface TransferResponse {
    /** Transfer ID */
    transferId: string;
    
    /** Transferred amount */
    amount: number;
    
    /** Transfer status */
    status: string;
    
    /** Destination account ID */
    destination?: string;
}

/**
 * Metadata for payment intent
 */
export interface PaymentIntentMetadata {
    /** Task ID */
    taskId: string;
    
    /** Agent ID */
    agentId: string;
    
    /** Customer ID */
    customerId: string;
    
    /** Whether escrow is enabled */
    escrowEnabled: string;
    
    /** Platform fee percentage */
    platformFeePercent: string;
    
    /** Description */
    description: string;
    
    /** Additional metadata */
    [key: string]: string;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
    /** Event type */
    type: string;
    
    /** Event data */
    data: {
        /** Object data */
        object: Record<string, unknown>;
    };
}

/**
 * Request to release escrow funds
 */
export interface ReleaseEscrowRequest {
    /** Escrow ID */
    escrowId: string;
    
    /** Release amount (for partial releases) */
    amount?: number;
    
    /** Release notes */
    notes?: string;
}

/**
 * Request to raise a dispute
 */
export interface RaiseDisputeRequest {
    /** Escrow ID */
    escrowId: string;
    
    /** Reason for dispute */
    reason: string;
    
    /** Evidence URLs */
    evidenceUrls?: string[];
}

/**
 * Committee vote submission
 */
export interface SubmitVoteRequest {
    /** Dispute ID */
    disputeId: string;
    
    /** Committee member's ClawID */
    committeeMemberClawId: string;
    
    /** Vote: true = payer wins, false = payee wins */
    voteForPayer: boolean;
    
    /** Optional vote justification */
    justification?: string;
}

// =====================================================
// RESPONSE INTERFACES
// =====================================================

/**
 * Escrow with full details
 */
export interface EscrowDetails extends Escrow {
    /** Associated milestones */
    milestones: EscrowMilestone[];
    
    /** Associated payments */
    payments: Payment[];
    
    /** Active dispute if any */
    activeDispute?: Dispute;
    
    /** User's role in this escrow */
    userRole: EscrowRole;
}

/**
 * Dispute with committee details
 */
export interface DisputeDetails extends Dispute {
    /** Associated escrow */
    escrow: Escrow;
    
    /** Committee member details (subset) */
    committeeMemberProfiles?: {
        clawId: string;
        reputation: number;
        hasVoted: boolean;
        vote?: boolean;
    }[];
}

/**
 * Payment result
 */
export interface PaymentResult {
    /** Created payment */
    payment: Payment;
    
    /** Client secret for Stripe confirmation */
    clientSecret?: string;
    
    /** Crypto payment address */
    paymentAddress?: string;
    
    /** Instructions for bank transfer */
    bankInstructions?: {
        accountNumber: string;
        routingNumber: string;
        reference: string;
    };
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Valid state transitions for escrows
 */
export const VALID_ESCROW_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
    [EscrowStatus.PENDING]: [EscrowStatus.FUNDED, EscrowStatus.CANCELLED],
    [EscrowStatus.FUNDED]: [EscrowStatus.IN_PROGRESS, EscrowStatus.DISPUTED, EscrowStatus.REFUNDED],
    [EscrowStatus.IN_PROGRESS]: [EscrowStatus.COMPLETED, EscrowStatus.DISPUTED],
    [EscrowStatus.COMPLETED]: [],
    [EscrowStatus.DISPUTED]: [EscrowStatus.COMPLETED, EscrowStatus.REFUNDED, EscrowStatus.IN_PROGRESS],
    [EscrowStatus.CANCELLED]: [],
    [EscrowStatus.REFUNDED]: [],
};

/**
 * Check if a state transition is valid
 */
export function isValidEscrowTransition(from: EscrowStatus, to: EscrowStatus): boolean {
    return VALID_ESCROW_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Escrow statistics
 */
export interface EscrowStats {
    /** Total escrows created */
    totalEscrows: number;
    
    /** Total value escrowed */
    totalVolume: number;
    
    /** Escrows by status */
    byStatus: Record<EscrowStatus, number>;
    
    /** Average resolution time (hours) */
    avgResolutionTime: number;
    
    /** Dispute rate (percentage) */
    disputeRate: number;
}

/**
 * Currency configuration
 */
export interface CurrencyConfig {
    /** Currency code */
    code: string;
    
    /** Display name */
    name: string;
    
    /** Symbol */
    symbol: string;
    
    /** Number of decimal places */
    decimals: number;
    
    /** Minimum amount */
    minAmount: number;
    
    /** Maximum amount */
    maxAmount: number;
    
    /** Supported payment methods */
    supportedMethods: PaymentMethod[];
    
    /** Platform fee percentage */
    platformFeePercent: number;
}

// =====================================================
// WEBHOOK TYPES
// =====================================================

/**
 * Stripe webhook event types we handle
 */
export type StripeWebhookEvent = 
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'charge.refunded'
    | 'charge.dispute.created';

/**
 * Payment webhook payload
 */
export interface PaymentWebhookPayload {
    /** Event type */
    type: StripeWebhookEvent | 'crypto_confirmation' | 'bank_transfer_confirmed';
    
    /** Payment ID in our system */
    paymentId: string;
    
    /** External transaction reference */
    externalRef: string;
    
    /** Event data */
    data: Record<string, unknown>;
    
    /** Timestamp */
    timestamp: Date;
}