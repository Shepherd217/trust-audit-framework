/**
 * ClawOS Escrow Service
 * State machine-enforced escrow management for secure transactions
 * @module lib/payments/escrow
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
    Escrow,
    EscrowStatus,
    Payment,
    PaymentStatus,
    PaymentMethod,
    Dispute,
    DisputeStatus,
    DisputeResolution,
    EscrowMilestone,
    CreateEscrowRequest,
    FundEscrowRequest,
    ReleaseEscrowRequest,
    RaiseDisputeRequest,
    SubmitVoteRequest,
    EscrowDetails,
    DisputeDetails,
    PaymentResult,
    EscrowRole,
    isValidEscrowTransition,
    CurrencyConfig,
} from '@/types/payments';

// =====================================================
// ERROR CLASSES
// =====================================================

export class EscrowError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'EscrowError';
    }
}

export class StateTransitionError extends EscrowError {
    constructor(from: EscrowStatus, to: EscrowStatus) {
        super(
            `Invalid state transition from ${from} to ${to}`,
            'INVALID_TRANSITION',
            { from, to }
        );
        this.name = 'StateTransitionError';
    }
}

export class InsufficientFundsError extends EscrowError {
    constructor(required: number, available: number) {
        super(
            `Insufficient funds: required ${required}, available ${available}`,
            'INSUFFICIENT_FUNDS',
            { required, available }
        );
        this.name = 'InsufficientFundsError';
    }
}

export class UnauthorizedError extends EscrowError {
    constructor(action: string, clawId: string) {
        super(
            `Unauthorized: ${clawId} cannot perform ${action}`,
            'UNAUTHORIZED',
            { action, clawId }
        );
        this.name = 'UnauthorizedError';
    }
}

// =====================================================
// ESCROW SERVICE
// =====================================================

export class EscrowService {
    constructor(private supabase: SupabaseClient) {}

    // =====================================================
    // CREATE ESCROW
    // =====================================================

    /**
     * Create a new escrow contract
     * @param request - Escrow creation parameters
     * @param creatorClawId - ClawID of the creator
     * @returns Created escrow
     */
    async createEscrow(
        request: CreateEscrowRequest,
        creatorClawId: string
    ): Promise<Escrow> {
        // Validate request
        if (request.amount <= 0) {
            throw new EscrowError('Amount must be positive', 'INVALID_AMOUNT');
        }

        if (request.payerClawId === request.payeeClawId) {
            throw new EscrowError('Payer and payee must be different', 'SAME_PARTY');
        }

        // Calculate expiry time
        const expiresAt = request.expiresInHours
            ? new Date(Date.now() + request.expiresInHours * 60 * 60 * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

        // Insert escrow
        const { data, error } = await this.supabase
            .from('escrows')
            .insert({
                claw_id: creatorClawId,
                payer_claw_id: request.payerClawId,
                payee_claw_id: request.payeeClawId,
                handoff_id: request.handoffId,
                amount: request.amount,
                currency: request.currency,
                description: request.description,
                status: EscrowStatus.PENDING,
                milestone_count: request.milestoneCount ?? 1,
                current_milestone: 0,
                dispute_count: 0,
                expires_at: expiresAt.toISOString(),
                metadata: request.metadata ?? {},
            })
            .select()
            .single();

        if (error) {
            throw new EscrowError('Failed to create escrow', 'CREATE_FAILED', { error });
        }

        // Create milestones if multi-stage
        if ((request.milestoneCount ?? 1) > 1) {
            await this.createMilestones(data.id, request.milestoneCount ?? 1, request.amount);
        }

        return this.mapEscrowFromDB(data);
    }

    /**
     * Create milestone records for multi-stage escrows
     */
    private async createMilestones(
        escrowId: string,
        count: number,
        totalAmount: number
    ): Promise<void> {
        const amountPerMilestone = totalAmount / count;
        const milestones = Array.from({ length: count }, (_, i) => ({
            escrow_id: escrowId,
            milestone_index: i,
            title: `Milestone ${i + 1}`,
            description: `Milestone ${i + 1} of ${count}`,
            amount: amountPerMilestone,
            status: EscrowStatus.PENDING,
        }));

        const { error } = await this.supabase
            .from('escrow_milestones')
            .insert(milestones);

        if (error) {
            throw new EscrowError('Failed to create milestones', 'MILESTONE_CREATE_FAILED', { error });
        }
    }

    // =====================================================
    // FUND ESCROW
    // =====================================================

    /**
     * Fund an escrow with payment
     * @param request - Funding parameters
     * @param payerClawId - ClawID of the payer
     * @returns Payment result with instructions
     */
    async fundEscrow(
        request: FundEscrowRequest,
        payerClawId: string
    ): Promise<PaymentResult> {
        // Get escrow
        const escrow = await this.getEscrowById(request.escrowId);

        // Validate
        if (escrow.payerClawId !== payerClawId) {
            throw new UnauthorizedError('fund escrow', payerClawId);
        }

        if (escrow.status !== EscrowStatus.PENDING) {
            throw new EscrowError(
                `Cannot fund escrow in ${escrow.status} state`,
                'INVALID_STATE'
            );
        }

        if (escrow.expiresAt && new Date(escrow.expiresAt) < new Date()) {
            throw new EscrowError('Escrow has expired', 'ESCROW_EXPIRED');
        }

        // Create payment record
        const { data: payment, error: paymentError } = await this.supabase
            .from('payments')
            .insert({
                escrow_id: escrow.id,
                claw_id: payerClawId,
                amount: escrow.amount,
                currency: escrow.currency,
                method: request.method,
                status: PaymentStatus.PENDING,
                platform_fee: this.calculatePlatformFee(escrow.amount, escrow.currency),
                metadata: {
                    wallet_address: request.walletAddress,
                    payment_method_id: request.paymentMethodId,
                },
            })
            .select()
            .single();

        if (paymentError) {
            throw new EscrowError('Failed to create payment', 'PAYMENT_CREATE_FAILED', { paymentError });
        }

        // Generate payment instructions based on method
        const result: PaymentResult = {
            payment: this.mapPaymentFromDB(payment),
        };

        switch (request.method) {
            case PaymentMethod.STRIPE:
                result.clientSecret = await this.createStripePaymentIntent(payment.id, escrow);
                break;
            case PaymentMethod.CRYPTO:
                result.paymentAddress = await this.generateCryptoAddress(payment.id, escrow.currency);
                break;
            case PaymentMethod.BANK_TRANSFER:
                result.bankInstructions = this.generateBankInstructions(payment.id);
                break;
            case PaymentMethod.CLAW_CREDIT:
                await this.processClawCreditPayment(payment.id, payerClawId, escrow.amount);
                break;
        }

        return result;
    }

    /**
     * Confirm payment and update escrow status
     */
    async confirmPayment(paymentId: string, externalRef: string): Promise<Escrow> {
        // Update payment status
        const { data: payment, error: paymentError } = await this.supabase
            .from('payments')
            .update({
                status: PaymentStatus.COMPLETED,
                processed_at: new Date().toISOString(),
                external_ref: externalRef,
            })
            .eq('id', paymentId)
            .select('escrow_id')
            .single();

        if (paymentError || !payment) {
            throw new EscrowError('Payment not found', 'PAYMENT_NOT_FOUND');
        }

        // The trigger will update escrow to 'funded', but we fetch to confirm
        const { data: escrow, error: escrowError } = await this.supabase
            .from('escrows')
            .select()
            .eq('id', payment.escrow_id)
            .single();

        if (escrowError) {
            throw new EscrowError('Failed to update escrow', 'ESCROW_UPDATE_FAILED');
        }

        return this.mapEscrowFromDB(escrow);
    }

    // =====================================================
    // RELEASE FUNDS
    // =====================================================

    /**
     * Release escrow funds to payee
     * @param request - Release parameters
     * @param payerClawId - ClawID of the payer (must authorize)
     * @returns Updated escrow
     */
    async releaseEscrow(
        request: ReleaseEscrowRequest,
        payerClawId: string
    ): Promise<Escrow> {
        const escrow = await this.getEscrowById(request.escrowId);

        // Authorization check
        if (escrow.payerClawId !== payerClawId) {
            throw new UnauthorizedError('release escrow', payerClawId);
        }

        // State validation
        if (!isValidEscrowTransition(escrow.status, EscrowStatus.COMPLETED)) {
            throw new StateTransitionError(escrow.status, EscrowStatus.COMPLETED);
        }

        // For milestone-based escrows, validate amount doesn't exceed remaining
        if (request.amount && request.amount > escrow.amount) {
            throw new InsufficientFundsError(request.amount, escrow.amount);
        }

        // Update escrow status
        const { data, error } = await this.supabase
            .from('escrows')
            .update({
                status: EscrowStatus.COMPLETED,
                completed_at: new Date().toISOString(),
                metadata: {
                    ...escrow.metadata,
                    release_notes: request.notes,
                    released_amount: request.amount ?? escrow.amount,
                },
            })
            .eq('id', request.escrowId)
            .select()
            .single();

        if (error) {
            throw new EscrowError('Failed to release escrow', 'RELEASE_FAILED', { error });
        }

        // Trigger fund transfer to payee
        await this.transferFundsToPayee(escrow);

        return this.mapEscrowFromDB(data);
    }

    /**
     * Start work on an escrow (payee marks as in_progress)
     */
    async startWork(escrowId: string, payeeClawId: string): Promise<Escrow> {
        const escrow = await this.getEscrowById(escrowId);

        if (escrow.payeeClawId !== payeeClawId) {
            throw new UnauthorizedError('start work', payeeClawId);
        }

        if (!isValidEscrowTransition(escrow.status, EscrowStatus.IN_PROGRESS)) {
            throw new StateTransitionError(escrow.status, EscrowStatus.IN_PROGRESS);
        }

        const { data, error } = await this.supabase
            .from('escrows')
            .update({
                status: EscrowStatus.IN_PROGRESS,
                started_at: new Date().toISOString(),
            })
            .eq('id', escrowId)
            .select()
            .single();

        if (error) {
            throw new EscrowError('Failed to start work', 'START_FAILED', { error });
        }

        return this.mapEscrowFromDB(data);
    }

    /**
     * Mark milestone as complete (triggers partial release)
     */
    async completeMilestone(
        escrowId: string,
        milestoneIndex: number,
        payeeClawId: string
    ): Promise<EscrowMilestone> {
        const escrow = await this.getEscrowById(escrowId);

        if (escrow.payeeClawId !== payeeClawId) {
            throw new UnauthorizedError('complete milestone', payeeClawId);
        }

        const { data, error } = await this.supabase
            .from('escrow_milestones')
            .update({
                status: EscrowStatus.COMPLETED,
                completed_at: new Date().toISOString(),
            })
            .eq('escrow_id', escrowId)
            .eq('milestone_index', milestoneIndex)
            .select()
            .single();

        if (error) {
            throw new EscrowError('Failed to complete milestone', 'MILESTONE_FAILED', { error });
        }

        // Check if all milestones complete
        await this.checkAllMilestonesComplete(escrowId);

        return this.mapMilestoneFromDB(data);
    }

    // =====================================================
    // RAISE DISPUTE
    // =====================================================

    /**
     * Raise a dispute on an escrow
     * @param request - Dispute parameters
     * @param initiatorClawId - ClawID of the party raising the dispute
     * @returns Created dispute
     */
    async raiseDispute(
        request: RaiseDisputeRequest,
        initiatorClawId: string
    ): Promise<Dispute> {
        const escrow = await this.getEscrowById(request.escrowId);

        // Verify initiator is a party to the escrow
        if (escrow.payerClawId !== initiatorClawId && escrow.payeeClawId !== initiatorClawId) {
            throw new UnauthorizedError('raise dispute', initiatorClawId);
        }

        // Can only dispute funded or in-progress escrows
        if (![EscrowStatus.FUNDED, EscrowStatus.IN_PROGRESS].includes(escrow.status)) {
            throw new EscrowError(
                `Cannot dispute escrow in ${escrow.status} state`,
                'INVALID_DISPUTE_STATE'
            );
        }

        // Determine respondent
        const respondentClawId = escrow.payerClawId === initiatorClawId
            ? escrow.payeeClawId
            : escrow.payerClawId;

        // Create dispute
        const { data: dispute, error: disputeError } = await this.supabase
            .from('disputes')
            .insert({
                escrow_id: request.escrowId,
                initiator_claw_id: initiatorClawId,
                respondent_claw_id: respondentClawId,
                reason: request.reason,
                evidence_urls: request.evidenceUrls ?? [],
                status: DisputeStatus.OPEN,
                resolution: DisputeResolution.PENDING,
                committee_size: 7,
                committee_members: [],
                votes_for_payer: 0,
                votes_for_payee: 0,
                slashed_members: [],
                slash_reasons: [],
                evidence_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours
                voting_deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
            })
            .select()
            .single();

        if (disputeError) {
            throw new EscrowError('Failed to create dispute', 'DISPUTE_CREATE_FAILED', { disputeError });
        }

        // Update escrow to disputed status
        const { error: escrowError } = await this.supabase
            .from('escrows')
            .update({
                status: EscrowStatus.DISPUTED,
                active_dispute_id: dispute.id,
                dispute_count: escrow.disputeCount + 1,
            })
            .eq('id', request.escrowId);

        if (escrowError) {
            throw new EscrowError('Failed to update escrow status', 'ESCROW_UPDATE_FAILED');
        }

        // Select committee members (Arbitra Layer 2)
        await this.selectCommittee(dispute.id);

        return this.mapDisputeFromDB(dispute);
    }

    /**
     * Submit committee vote
     */
    async submitVote(
        request: SubmitVoteRequest,
        committeeMemberClawId: string
    ): Promise<Dispute> {
        const dispute = await this.getDisputeById(request.disputeId);

        // Verify committee membership
        if (!dispute.committeeMembers.includes(committeeMemberClawId)) {
            throw new UnauthorizedError('submit vote', committeeMemberClawId);
        }

        if (dispute.status !== DisputeStatus.VOTING) {
            throw new EscrowError('Dispute is not in voting phase', 'NOT_VOTING');
        }

        // Record vote
        const votesForPayer = request.voteForPayer
            ? dispute.votesForPayer + 1
            : dispute.votesForPayer;
        const votesForPayee = !request.voteForPayer
            ? dispute.votesForPayee + 1
            : dispute.votesForPayee;

        const { data, error } = await this.supabase
            .from('disputes')
            .update({
                votes_for_payer: votesForPayer,
                votes_for_payee: votesForPayee,
            })
            .eq('id', request.disputeId)
            .select()
            .single();

        if (error) {
            throw new EscrowError('Failed to record vote', 'VOTE_FAILED', { error });
        }

        // Check if voting complete
        const totalVotes = votesForPayer + votesForPayee;
        if (totalVotes >= dispute.committeeSize) {
            await this.resolveDispute(request.disputeId);
        }

        return this.mapDisputeFromDB(data);
    }

    /**
     * Resolve dispute based on committee votes
     */
    private async resolveDispute(disputeId: string): Promise<void> {
        const dispute = await this.getDisputeById(disputeId);

        // Determine winner (majority)
        let resolution: DisputeResolution;
        if (dispute.votesForPayer > dispute.votesForPayee) {
            resolution = DisputeResolution.PAYER_WINS;
        } else if (dispute.votesForPayee > dispute.votesForPayer) {
            resolution = DisputeResolution.PAYEE_WINS;
        } else {
            resolution = DisputeResolution.SPLIT; // Tie = split
        }

        // Update dispute
        await this.supabase
            .from('disputes')
            .update({
                status: DisputeStatus.RESOLVED,
                resolution,
                resolved_at: new Date().toISOString(),
                resolved_by: 'committee',
            })
            .eq('id', disputeId);

        // The trigger will handle escrow status update
    }

    // =====================================================
    // QUERY METHODS
    // =====================================================

    /**
     * Get escrow by ID with full details
     */
    async getEscrow(escrowId: string, viewerClawId: string): Promise<EscrowDetails> {
        const escrow = await this.getEscrowById(escrowId);

        // Verify viewer is authorized
        if (![escrow.payerClawId, escrow.payeeClawId, escrow.clawId].includes(viewerClawId)) {
            throw new UnauthorizedError('view escrow', viewerClawId);
        }

        // Get milestones
        const { data: milestones } = await this.supabase
            .from('escrow_milestones')
            .select()
            .eq('escrow_id', escrowId)
            .order('milestone_index');

        // Get payments
        const { data: payments } = await this.supabase
            .from('payments')
            .select()
            .eq('escrow_id', escrowId)
            .order('created_at', { ascending: false });

        // Get active dispute
        let activeDispute: Dispute | undefined;
        if (escrow.activeDisputeId) {
            activeDispute = await this.getDisputeById(escrow.activeDisputeId);
        }

        // Determine user role
        let userRole = EscrowRole.CREATOR;
        if (viewerClawId === escrow.payerClawId) userRole = EscrowRole.PAYER;
        else if (viewerClawId === escrow.payeeClawId) userRole = EscrowRole.PAYEE;

        return {
            ...escrow,
            milestones: (milestones ?? []).map(this.mapMilestoneFromDB),
            payments: (payments ?? []).map(this.mapPaymentFromDB),
            activeDispute,
            userRole,
        };
    }

    /**
     * List escrows for a user
     */
    async listEscrows(
        clawId: string,
        options?: {
            status?: EscrowStatus;
            role?: 'payer' | 'payee' | 'any';
            limit?: number;
            offset?: number;
        }
    ): Promise<{ escrows: Escrow[]; total: number }> {
        let query = this.supabase.from('escrows').select('*', { count: 'exact' });

        // Role filter
        switch (options?.role) {
            case 'payer':
                query = query.eq('payer_claw_id', clawId);
                break;
            case 'payee':
                query = query.eq('payee_claw_id', clawId);
                break;
            default:
                query = query.or(`payer_claw_id.eq.${clawId},payee_claw_id.eq.${clawId},claw_id.eq.${clawId}`);
        }

        // Status filter
        if (options?.status) {
            query = query.eq('status', options.status);
        }

        // Pagination
        const limit = options?.limit ?? 20;
        const offset = options?.offset ?? 0;
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            throw new EscrowError('Failed to list escrows', 'LIST_FAILED', { error });
        }

        return {
            escrows: (data ?? []).map(this.mapEscrowFromDB),
            total: count ?? 0,
        };
    }

    /**
     * Get dispute by ID
     */
    async getDispute(disputeId: string, viewerClawId: string): Promise<DisputeDetails> {
        const dispute = await this.getDisputeById(disputeId);

        // Verify viewer is authorized
        const isAuthorized =
            dispute.initiatorClawId === viewerClawId ||
            dispute.respondentClawId === viewerClawId ||
            dispute.committeeMembers.includes(viewerClawId);

        if (!isAuthorized) {
            throw new UnauthorizedError('view dispute', viewerClawId);
        }

        const escrow = await this.getEscrowById(dispute.escrowId);

        return {
            ...dispute,
            escrow,
        };
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================

    private async getEscrowById(id: string): Promise<Escrow> {
        const { data, error } = await this.supabase
            .from('escrows')
            .select()
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new EscrowError('Escrow not found', 'NOT_FOUND', { id });
        }

        return this.mapEscrowFromDB(data);
    }

    private async getDisputeById(id: string): Promise<Dispute> {
        const { data, error } = await this.supabase
            .from('disputes')
            .select()
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new EscrowError('Dispute not found', 'NOT_FOUND', { id });
        }

        return this.mapDisputeFromDB(data);
    }

    private async checkAllMilestonesComplete(escrowId: string): Promise<void> {
        const { data: milestones } = await this.supabase
            .from('escrow_milestones')
            .select('status')
            .eq('escrow_id', escrowId);

        const allComplete = milestones?.every(m => m.status === EscrowStatus.COMPLETED);

        if (allComplete) {
            await this.supabase
                .from('escrows')
                .update({
                    status: EscrowStatus.COMPLETED,
                    completed_at: new Date().toISOString(),
                })
                .eq('id', escrowId);
        }
    }

    private async selectCommittee(disputeId: string): Promise<void> {
        // TODO: Integrate with TAP Layer 1 to select high-reputation agents
        // For now, placeholder - would query TAP for eligible committee members
        // Weighted by EigenTrust score with vintage decay
    }

    private calculatePlatformFee(amount: number, currency: string): number {
        // 2.5% platform fee
        return amount * 0.025;
    }

    private async createStripePaymentIntent(paymentId: string, escrow: Escrow): Promise<string> {
        // TODO: Integrate with Stripe
        return `pi_${paymentId}_secret`;
    }

    private async generateCryptoAddress(paymentId: string, currency: string): Promise<string> {
        // TODO: Integrate with wallet service
        return `0x${paymentId.replace(/-/g, '')}`;
    }

    private generateBankInstructions(paymentId: string): { accountNumber: string; routingNumber: string; reference: string } {
        return {
            accountNumber: '****1234',
            routingNumber: '021000021',
            reference: `CLAW-${paymentId.slice(0, 8).toUpperCase()}`,
        };
    }

    private async processClawCreditPayment(paymentId: string, clawId: string, amount: number): Promise<void> {
        // TODO: Deduct from user's ClawCredit balance
        await this.confirmPayment(paymentId, `claw_credit_${paymentId}`);
    }

    private async transferFundsToPayee(escrow: Escrow): Promise<void> {
        // TODO: Trigger actual fund transfer via crypto/Stripe/bank
        console.error(`Transferring ${escrow.amount} ${escrow.currency} to ${escrow.payeeClawId}`);
    }

    // =====================================================
    // DATABASE MAPPERS
    // =====================================================

    private mapEscrowFromDB(data: any): Escrow {
        return {
            id: data.id,
            clawId: data.claw_id,
            payerClawId: data.payer_claw_id,
            payeeClawId: data.payee_claw_id,
            handoffId: data.handoff_id,
            amount: parseFloat(data.amount),
            currency: data.currency,
            description: data.description,
            status: data.status as EscrowStatus,
            milestoneCount: data.milestone_count,
            currentMilestone: data.current_milestone,
            createdAt: new Date(data.created_at),
            fundedAt: data.funded_at ? new Date(data.funded_at) : undefined,
            startedAt: data.started_at ? new Date(data.started_at) : undefined,
            completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
            expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
            activeDisputeId: data.active_dispute_id,
            disputeCount: data.dispute_count,
            metadata: data.metadata ?? {},
        };
    }

    private mapPaymentFromDB(data: any): Payment {
        return {
            id: data.id,
            escrowId: data.escrow_id,
            clawId: data.claw_id,
            amount: parseFloat(data.amount),
            currency: data.currency,
            method: data.method as PaymentMethod,
            status: data.status as PaymentStatus,
            txHash: data.tx_hash,
            stripePaymentIntentId: data.stripe_payment_intent_id,
            externalRef: data.external_ref,
            createdAt: new Date(data.created_at),
            processedAt: data.processed_at ? new Date(data.processed_at) : undefined,
            platformFee: parseFloat(data.platform_fee),
            processingFee: parseFloat(data.processing_fee),
            metadata: data.metadata ?? {},
        };
    }

    private mapDisputeFromDB(data: any): Dispute {
        return {
            id: data.id,
            escrowId: data.escrow_id,
            initiatorClawId: data.initiator_claw_id,
            respondentClawId: data.respondent_claw_id,
            reason: data.reason,
            evidenceUrls: data.evidence_urls ?? [],
            committeeSize: data.committee_size,
            committeeMembers: data.committee_members ?? [],
            votesForPayer: data.votes_for_payer,
            votesForPayee: data.votes_for_payee,
            status: data.status as DisputeStatus,
            resolution: data.resolution as DisputeResolution,
            resolutionNotes: data.resolution_notes,
            resolvedBy: data.resolved_by,
            resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
            createdAt: new Date(data.created_at),
            evidenceDeadline: data.evidence_deadline ? new Date(data.evidence_deadline) : undefined,
            votingDeadline: data.voting_deadline ? new Date(data.voting_deadline) : undefined,
            slashedMembers: data.slashed_members ?? [],
            slashReasons: data.slash_reasons ?? [],
            metadata: data.metadata ?? {},
        };
    }

    private mapMilestoneFromDB(data: any): EscrowMilestone {
        return {
            id: data.id,
            escrowId: data.escrow_id,
            milestoneIndex: data.milestone_index,
            title: data.title,
            description: data.description,
            amount: parseFloat(data.amount),
            status: data.status as EscrowStatus,
            createdAt: new Date(data.created_at),
            completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        };
    }
}

// =====================================================
// EXPORT SINGLETON FACTORY
// =====================================================

let escrowService: EscrowService | null = null;

export function getEscrowService(supabase: SupabaseClient): EscrowService {
    if (!escrowService) {
        escrowService = new EscrowService(supabase);
    }
    return escrowService;
}