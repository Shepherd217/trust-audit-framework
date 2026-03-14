/**
 * TAP-Escrow Integration
 * 
 * Connects TAP reputation service to existing escrow/dispute system.
 * Replaces the TODO in lib/payments/escrow.ts selectCommittee()
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getTAPService, TAPService } from './index';
import { getBus } from '../bus';
import { 
  EscrowService 
} from '@/lib/payments/escrow';
import {
  EscrowStatus,
  DisputeStatus,
  DisputeResolution 
} from '@/types/payments';

// ============================================================================
// ENHANCED ESCROW SERVICE WITH TAP
// ============================================================================

export class TAPEnhancedEscrowService extends EscrowService {
  private tapService: TAPService;
  private bus: ReturnType<typeof getBus>;
  private supabaseClient: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    super(supabase);
    this.supabaseClient = supabase;
    this.tapService = getTAPService(supabase);
    this.bus = getBus({
      enablePersistence: true,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    });
  }

  // ========================================================================
  // TAP-Enhanced Committee Selection
  // ========================================================================

  /**
   * Select committee using TAP reputation-weighted selection
   * Extends parent class with TAP integration
   */
  async selectCommitteeWithTAP(disputeId: string): Promise<void> {
    // Get dispute details
    const { data: dispute, error: disputeError } = await this.supabaseClient
      .from('disputes')
      .select('*, escrows!inner(payer_claw_id, payee_claw_id)')
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new Error(`Dispute not found: ${disputeError?.message}`);
    }

    // Exclude parties to the dispute
    const excludeClawIds = [
      dispute.escrows.payer_claw_id,
      dispute.escrows.payee_claw_id,
    ];

    // Use TAP service for weighted selection
    const committee = await this.tapService.selectCommittee({
      disputeId,
      size: 7,
      minTapScore: 4000, // Silver tier minimum
      excludeClawIds,
    });

    // Update dispute with committee
    await this.supabaseClient
      .from('disputes')
      .update({
        committee_members: committee.map(m => m.clawId),
        status: DisputeStatus.VOTING,
      })
      .eq('id', disputeId);

    // Broadcast to committee members via ClawBus
    for (const member of committee) {
      await this.bus.send({
        id: `committee_${disputeId}_${member.clawId}`,
        version: "1.0",
        ttl: 3600,
        createdAt: new Date(),
        status: 'pending',
        from: 'arbitra_system',
        to: member.clawId,
        type: 'committee_selected',
        payload: {
          disputeId,
          votingEndsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          message: `You have been selected for committee duty on dispute ${disputeId.slice(0, 8)}`,
        },
        priority: 'high',
      });
    }

    // Broadcast to dispute parties
    await this.bus.publish('dispute_updates', {
      id: `dispute_update_${disputeId}`,
      version: "1.0",
      ttl: 3600,
      createdAt: new Date(),
      status: 'pending',
      type: 'committee_selected',
      disputeId,
      committeeSize: committee.length,
      timestamp: new Date().toISOString(),
    }, 'arbitra_system');

    // Record committee participation TAP scores
    for (const member of committee) {
      await this.tapService.recordEvent(
        member.clawId,
        'committee_vote',
        `Selected for committee on dispute ${disputeId.slice(0, 8)}`,
        { disputeId }
      );
    }
  }

  // ========================================================================
  // TAP-Enhanced Dispute Resolution
  // ========================================================================

  /**
   * Resolve dispute and update TAP scores
   * Note: This extends (not overrides) the parent resolveDispute
   */
  async resolveDisputeWithTAP(disputeId: string): Promise<void> {
    // Get dispute details
    const { data: dispute, error: disputeError } = await this.supabaseClient
      .from('disputes')
      .select('*, escrows!inner(payer_claw_id, payee_claw_id, amount)')
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new Error(`Dispute not found: ${disputeError?.message}`);
    }

    const { votes_for_payer, votes_for_payee, committee_members } = dispute;
    const totalVotes = votes_for_payer + votes_for_payee;
    const majorityThreshold = Math.ceil(committee_members.length / 2);

    // Determine winner
    let resolution: DisputeResolution;
    let winnerClawId: string;
    let loserClawId: string;

    if (votes_for_payer >= majorityThreshold) {
      resolution = DisputeResolution.PAYER_WINS;
      winnerClawId = dispute.escrows.payer_claw_id;
      loserClawId = dispute.escrows.payee_claw_id;
    } else if (votes_for_payee >= majorityThreshold) {
      resolution = DisputeResolution.PAYEE_WINS;
      winnerClawId = dispute.escrows.payee_claw_id;
      loserClawId = dispute.escrows.payer_claw_id;
    } else {
      resolution = DisputeResolution.SPLIT;
      // For split, both parties lose some reputation
      winnerClawId = '';
      loserClawId = '';
    }

    // Update dispute status
    await this.supabaseClient
      .from('disputes')
      .update({
        status: DisputeStatus.RESOLVED,
        resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: 'committee',
      })
      .eq('id', disputeId);

    // Update escrow status
    await this.supabaseClient
      .from('escrows')
      .update({
        status: resolution === DisputeResolution.PAYER_WINS 
          ? EscrowStatus.REFUNDED 
          : EscrowStatus.COMPLETED,
      })
      .eq('id', dispute.escrow_id);

    // Update TAP scores based on resolution
    if (resolution === DisputeResolution.SPLIT) {
      // Both parties lose reputation for unresolved disputes
      await this.tapService.recordEvent(
        dispute.escrows.payer_claw_id,
        'dispute_lost',
        'Dispute resulted in split decision',
        { disputeId, resolution: 'split' }
      );
      await this.tapService.recordEvent(
        dispute.escrows.payee_claw_id,
        'dispute_lost',
        'Dispute resulted in split decision',
        { disputeId, resolution: 'split' }
      );
    } else {
      // Winner gains reputation, loser loses (2x severity)
      await this.tapService.recordEvent(
        winnerClawId,
        'dispute_won',
        `Won dispute ${disputeId.slice(0, 8)}`,
        { disputeId, resolution }
      );
      await this.tapService.recordEvent(
        loserClawId,
        'dispute_lost',
        `Lost dispute ${disputeId.slice(0, 8)}`,
        { disputeId, resolution }
      );
    }

    // Record committee vote accuracy
    const winningVotes = resolution === DisputeResolution.PAYER_WINS 
      ? votes_for_payer 
      : votes_for_payee;
    
    // Notify all parties
    await this.bus.publish('dispute_updates', {
      id: `dispute_resolved_${disputeId}`,
      version: "1.0",
      ttl: 3600,
      createdAt: new Date(),
      status: 'pending',
      type: 'dispute_resolved',
      disputeId,
      resolution,
      winnerId: winnerClawId,
      timestamp: new Date().toISOString(),
    }, 'arbitra_system');

    // Send direct message to parties
    if (winnerClawId) {
      await this.bus.send({
        id: `winner_notif_${disputeId}`,
        version: "1.0",
        ttl: 3600,
        createdAt: new Date(),
        status: 'pending',
        from: 'arbitra_system',
        to: winnerClawId,
        type: 'dispute_won',
        payload: {
          disputeId,
          amount: dispute.escrows.amount,
          message: `You won the dispute and received ${dispute.escrows.amount} cents`,
        },
        priority: 'high',
      });
    }

    if (loserClawId) {
      await this.bus.send({
        id: `loser_notif_${disputeId}`,
        version: "1.0",
        ttl: 3600,
        createdAt: new Date(),
        status: 'pending',
        from: 'arbitra_system',
        to: loserClawId,
        type: 'dispute_lost',
        payload: {
          disputeId,
          message: 'You lost the dispute. Your reputation has been affected.',
        },
        priority: 'high',
      });
    }
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let tapEnhancedEscrowService: TAPEnhancedEscrowService | null = null;

export function getTAPEnhancedEscrowService(supabase: SupabaseClient): TAPEnhancedEscrowService {
  if (!tapEnhancedEscrowService) {
    tapEnhancedEscrowService = new TAPEnhancedEscrowService(supabase);
  }
  return tapEnhancedEscrowService;
}

export function resetTAPEnhancedEscrowService(): void {
  tapEnhancedEscrowService = null;
}

export default TAPEnhancedEscrowService;
