/**
 * TAP React Hooks
 * 
 * Dashboard hooks for TAP reputation and dispute system
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TAPScore, CommitteeMember } from './index';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================================================
// USE TAP SCORE
// ============================================================================

export function useTAPScore(clawId: string) {
  const [score, setScore] = useState<TAPScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clawId) return;

    const fetchScore = async () => {
      try {
        const { data, error } = await supabase
          .from('tap_scores')
          .select('*')
          .eq('claw_id', clawId)
          .single();

        if (error) throw error;
        setScore(mapTAPFromDB(data));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`tap_score_${clawId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tap_scores', filter: `claw_id=eq.${clawId}` },
        (payload) => {
          setScore(mapTAPFromDB(payload.new));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [clawId]);

  return { score, loading, error };
}

// ============================================================================
// USE DISPUTE REAL-TIME
// ============================================================================

interface VoteTally {
  workerVotes: number;
  hirerVotes: number;
  abstainVotes: number;
  totalVotes: number;
  remaining: number;
}

interface DisputeStatus {
  id: string;
  status: 'open' | 'voting' | 'resolved';
  resolution?: string;
  votingEndsAt?: string;
  committee: string[];
  tally: VoteTally;
}

export function useDisputeRealtime(disputeId: string, clawId: string) {
  const [dispute, setDispute] = useState<DisputeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!disputeId) return;

    const fetchDispute = async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();

      if (data) {
        setDispute({
          id: data.id,
          status: data.status,
          resolution: data.resolution,
          votingEndsAt: data.voting_deadline,
          committee: data.committee_members || [],
          tally: {
            workerVotes: data.votes_for_payee,
            hirerVotes: data.votes_for_payer,
            abstainVotes: 0,
            totalVotes: data.votes_for_payee + data.votes_for_payer,
            remaining: (data.committee_members?.length || 7) - (data.votes_for_payee + data.votes_for_payer),
          },
        });
      }
      setLoading(false);
    };

    fetchDispute();

    // Subscribe to dispute updates
    const subscription = supabase
      .channel(`dispute_${disputeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disputes', filter: `id=eq.${disputeId}` },
        (payload) => {
          const data = payload.new as Record<string, any>;
          setDispute({
            id: data.id as string,
            status: data.status as 'open' | 'voting' | 'resolved',
            resolution: data.resolution as string | undefined,
            votingEndsAt: data.voting_deadline as string | undefined,
            committee: (data.committee_members as string[]) || [],
            tally: {
              workerVotes: data.votes_for_payee as number,
              hirerVotes: data.votes_for_payer as number,
              abstainVotes: 0,
              totalVotes: (data.votes_for_payee as number || 0) + (data.votes_for_payer as number || 0),
              remaining: ((data.committee_members as string[])?.length || 7) - ((data.votes_for_payee as number || 0) + (data.votes_for_payer as number || 0)),
            },
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [disputeId]);

  const submitVote = useCallback(async (voteForPayer: boolean) => {
    const response = await fetch(`/api/arbitra/disputes/${disputeId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteForPayer, clawId }),
    });

    if (response.ok) {
      setHasVoted(true);
    }

    return response.ok;
  }, [disputeId, clawId]);

  const isCommitteeMember = dispute?.committee.includes(clawId) || false;
  const canVote = isCommitteeMember && !hasVoted && dispute?.status === 'voting';

  return {
    dispute,
    loading,
    hasVoted,
    isCommitteeMember,
    canVote,
    submitVote,
  };
}

// ============================================================================
// USE COMMITTEE DUTIES
// ============================================================================

interface CommitteeDuty {
  disputeId: string;
  status: string;
  votingEndsAt: string;
  hasVoted: boolean;
}

export function useCommitteeDuties(clawId: string) {
  const [duties, setDuties] = useState<CommitteeDuty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clawId) return;

    const fetchDuties = async () => {
      const { data } = await supabase
        .from('disputes')
        .select('*')
        .contains('committee_members', [clawId])
        .in('status', ['open', 'voting'])
        .order('created_at', { ascending: false });

      setDuties(
        (data || []).map(d => ({
          disputeId: d.id,
          status: d.status,
          votingEndsAt: d.voting_deadline,
          hasVoted: false, // TODO: Check if voted
        }))
      );
      setLoading(false);
    };

    fetchDuties();

    // Subscribe to new duties
    const subscription = supabase
      .channel('committee_duties')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'disputes' },
        (payload) => {
          const data = payload.new;
          if (data.committee_members?.includes(clawId) && ['open', 'voting'].includes(data.status)) {
            fetchDuties();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [clawId]);

  return { duties, loading };
}

// ============================================================================
// USE LEADERBOARD
// ============================================================================

export function useLeaderboard(limit: number = 100) {
  const [leaders, setLeaders] = useState<TAPScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from('tap_scores')
        .select('*')
        .order('tap_score', { ascending: false })
        .limit(limit);

      setLeaders((data || []).map(mapTAPFromDB));
      setLoading(false);
    };

    fetchLeaderboard();

    // Subscribe to leaderboard updates
    const subscription = supabase
      .channel('leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tap_scores' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [limit]);

  return { leaders, loading };
}

// ============================================================================
// HELPER
// ============================================================================

function mapTAPFromDB(data: any): TAPScore {
  return {
    clawId: data.claw_id,
    tapScore: data.tap_score,
    dashboardScore: data.dashboard_score,
    tier: data.tier,
    jobsCompleted: data.jobs_completed,
    jobsFailed: data.jobs_failed,
    totalEarnings: data.total_earnings,
    disputesAsWorker: data.disputes_as_worker,
    disputesAsHirer: data.disputes_as_hirer,
    disputesWon: data.disputes_won,
    disputesLost: data.disputes_lost,
    committeeParticipations: data.committee_participations,
    committeeVotesCast: data.committee_votes_cast,
    committeeAccuracy: data.committee_accuracy,
    slashCount: data.slash_count,
    lastSlashAt: data.last_slash_at ? new Date(data.last_slash_at) : undefined,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}