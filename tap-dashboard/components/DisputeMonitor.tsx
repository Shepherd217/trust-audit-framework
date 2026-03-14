'use client';

import React, { useState } from 'react';
import { Scale, Clock, Users, ChevronRight, Check, X, AlertCircle, MessageSquare, FileText } from 'lucide-react';

const COLORS = {
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  primary: '#00FF9F',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
  success: '#00FF9F',
  warning: '#FFB800',
  error: '#FF3366',
  info: '#3B82F6',
};

export type DisputeStatus = 'open' | 'voting' | 'resolved';
export type DisputeResolution = 'payer_wins' | 'payee_wins' | 'split' | null;
export type VoteChoice = 'payer' | 'payee' | 'abstain';

export interface Dispute {
  id: string;
  escrowId: string;
  initiatorClawId: string;
  respondentClawId: string;
  reason: string;
  amount: number;
  currency: string;
  status: DisputeStatus;
  resolution?: DisputeResolution;
  votesForPayer: number;
  votesForPayee: number;
  committeeSize: number;
  committeeMembers: string[];
  evidenceUrls: string[];
  votingEndsAt?: string;
  createdAt: string;
}

export interface DisputeMonitorProps {
  disputes: Dispute[];
  currentClawId: string;
  onVote?: (disputeId: string, vote: VoteChoice) => void;
  onViewDetails?: (disputeId: string) => void;
}

const DISPUTE_REASONS: Record<string, string> = {
  'WORK_NOT_DELIVERED': 'Work not delivered',
  'WORK_SUBSTANDARD': 'Work substandard',
  'SCOPE_CREEP': 'Scope creep',
  'COMMUNICATION_BREAKDOWN': 'Communication breakdown',
  'OTHER': 'Other',
};

export function DisputeMonitor({ disputes, currentClawId, onVote, onViewDetails }: DisputeMonitorProps) {
  const activeDisputes = disputes.filter(d => d.status !== 'resolved');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
  const isCommitteeMember = (dispute: Dispute) => dispute.committeeMembers.includes(currentClawId);
  const hasVoted = (dispute: Dispute) => false; // Would be determined by backend

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard 
          label="Active Disputes" 
          value={activeDisputes.length} 
          color={activeDisputes.length > 0 ? COLORS.warning : COLORS.success}
          icon={<Scale size={20} />}
        />
        <StatCard 
          label="Your Committee Duty" 
          value={activeDisputes.filter(d => isCommitteeMember(d)).length}
          color={COLORS.primary}
          icon={<Users size={20} />}
        />
        <StatCard 
          label="Resolved" 
          value={resolvedDisputes.length}
          color={COLORS.textSecondary}
          icon={<Check size={20} />}
        />
      </div>

      {/* Active Disputes */}
      {activeDisputes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: COLORS.text }}>
            Active Disputes ({activeDisputes.length})
          </h3>
          {activeDisputes.map(dispute => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              isCommitteeMember={isCommitteeMember(dispute)}
              hasVoted={hasVoted(dispute)}
              onVote={onVote}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {activeDisputes.length === 0 && (
        <div 
          className="text-center py-12 rounded-2xl"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${COLORS.success}10` }}
          >
            <Scale size={32} style={{ color: COLORS.success }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.text }}>No Active Disputes</h3>
          <p style={{ color: COLORS.textMuted }}>The ecosystem is running smoothly</p>
        </div>
      )}

      {/* Resolved Disputes */}
      {resolvedDisputes.length > 0 && (
        <div className="space-y-3 mt-6">
          <h3 className="text-lg font-semibold" style={{ color: COLORS.textMuted }}>
            Recently Resolved
          </h3>
          {resolvedDisputes.slice(0, 3).map(dispute => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              isCommitteeMember={false}
              hasVoted={true}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeCard({ 
  dispute, 
  isCommitteeMember, 
  hasVoted,
  compact = false,
  onVote,
  onViewDetails 
}: { 
  dispute: Dispute; 
  isCommitteeMember: boolean;
  hasVoted: boolean;
  compact?: boolean;
  onVote?: (disputeId: string, vote: VoteChoice) => void;
  onViewDetails?: (disputeId: string) => void;
}) {
  const [showVoteModal, setShowVoteModal] = useState(false);
  const totalVotes = dispute.votesForPayer + dispute.votesForPayee;
  const votesNeeded = Math.ceil(dispute.committeeSize / 2);
  const timeRemaining = dispute.votingEndsAt 
    ? new Date(dispute.votingEndsAt).getTime() - Date.now()
    : 0;
  const isExpired = timeRemaining <= 0;
  const formattedTime = isExpired 
    ? 'Voting closed'
    : formatTimeRemaining(timeRemaining);

  if (compact) {
    return (
      <div 
        className="p-4 rounded-xl flex items-center justify-between"
        style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ 
              backgroundColor: dispute.resolution 
                ? `${getResolutionColor(dispute.resolution)}10`
                : COLORS.surfaceLight 
            }}
          >
            <Scale 
              size={20} 
              style={{ 
                color: dispute.resolution 
                  ? getResolutionColor(dispute.resolution)
                  : COLORS.textMuted 
              }} 
            />
          </div>
          <div>
            <p className="font-medium" style={{ color: COLORS.text }}>
              {DISPUTE_REASONS[dispute.reason] || dispute.reason}
            </p>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>
              {dispute.amount > 0 && `$${(dispute.amount / 100).toFixed(2)}`} • {formatDate(dispute.createdAt)}
            </p>
          </div>
        </div>
        {dispute.resolution && (
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium"
            style={{ 
              backgroundColor: `${getResolutionColor(dispute.resolution)}20`,
              color: getResolutionColor(dispute.resolution)
            }}
          >
            {getResolutionLabel(dispute.resolution)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: isCommitteeMember ? `${COLORS.primary}10` : COLORS.surfaceLight }}
            >
              <Scale 
                size={24} 
                style={{ color: isCommitteeMember ? COLORS.primary : COLORS.textMuted }} 
              />
            </div>
            <div>
              <h4 className="font-semibold" style={{ color: COLORS.text }}>
                {DISPUTE_REASONS[dispute.reason] || dispute.reason}
              </h4>
              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                Dispute #{dispute.id.slice(0, 8)}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: COLORS.primary }}>
              {dispute.amount > 0 && `$${(dispute.amount / 100).toFixed(2)}`}
            </p>
            <div className="flex items-center gap-1 text-sm" style={{ color: COLORS.textMuted }}>
              <Clock size={14} />
              {formattedTime}
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg" style={{ backgroundColor: COLORS.surfaceLight }}>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>Hirer</p>
            <p className="font-medium truncate" style={{ color: COLORS.text }}>
              {dispute.initiatorClawId.slice(0, 16)}...
            </p>
          </div>
          
          <div className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: COLORS.border, color: COLORS.textMuted }}>
            VS
          </div>
          
          <div className="flex-1 text-right">
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>Worker</p>
            <p className="font-medium truncate" style={{ color: COLORS.text }}>
              {dispute.respondentClawId.slice(0, 16)}...
            </p>
          </div>
        </div>

        {/* Vote Progress */}
        {dispute.status === 'voting' && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: COLORS.textMuted }}>Vote Progress</span>
              <span style={{ color: COLORS.text }}>{totalVotes}/{dispute.committeeSize} votes</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: COLORS.surfaceLight }}>
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${(dispute.votesForPayer / dispute.committeeSize) * 100}%`,
                  backgroundColor: COLORS.error
                }}
              />
              <div 
                className="h-full transition-all duration-300"
                style={{ 
                  width: `${(dispute.votesForPayee / dispute.committeeSize) * 100}%`,
                  backgroundColor: COLORS.success
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span style={{ color: COLORS.error }}>Hirer: {dispute.votesForPayer}</span>
              <span style={{ color: COLORS.textMuted }}>Need {votesNeeded} to resolve</span>
              <span style={{ color: COLORS.success }}>Worker: {dispute.votesForPayee}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              style={{ color: COLORS.textMuted }}
              onClick={() => onViewDetails?.(dispute.id)}
            >
              <FileText size={16} />
              View Evidence
            </button>
            
            {dispute.evidenceUrls.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.textMuted }}>
                {dispute.evidenceUrls.length} file{dispute.evidenceUrls.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {isCommitteeMember && dispute.status === 'voting' && !hasVoted && !isExpired && (
            <button
              className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all hover:scale-105"
              style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
              onClick={() => setShowVoteModal(true)}
            >
              Cast Vote
              <ChevronRight size={16} />
            </button>
          )}

          {isCommitteeMember && hasVoted && (
            <span 
              className="px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              style={{ backgroundColor: `${COLORS.success}20`, color: COLORS.success }}
            >
              <Check size={16} />
              Vote Recorded
            </span>
          )}

          {!isCommitteeMember && dispute.status === 'voting' && (
            <span className="text-sm" style={{ color: COLORS.textMuted }}>
              <Users size={14} className="inline mr-1" />
              Committee Voting
            </span>
          )}
        </div>
      </div>

      {/* Vote Modal Overlay */}
      {showVoteModal && (
        <VoteModal 
          dispute={dispute}
          onVote={(vote) => {
            onVote?.(dispute.id, vote);
            setShowVoteModal(false);
          }}
          onClose={() => setShowVoteModal(false)}
        />
      )}
    </div>
  );
}

function VoteModal({ 
  dispute, 
  onVote, 
  onClose 
}: { 
  dispute: Dispute; 
  onVote: (vote: VoteChoice) => void;
  onClose: () => void;
}) {
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
    >
      <div className="max-w-md w-full rounded-2xl p-6" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: `${COLORS.primary}10` }}
          >
            <Scale size={32} style={{ color: COLORS.primary }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Cast Your Vote</h3>
          <p style={{ color: COLORS.textMuted }}>
            Review the evidence and vote for the party you believe is correct.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <VoteOption
            selected={selectedVote === 'payer'}
            onClick={() => setSelectedVote('payer')}
            label="Vote for Hirer"
            description="The worker failed to deliver"
            color={COLORS.error}
          />
          
          <VoteOption
            selected={selectedVote === 'payee'}
            onClick={() => setSelectedVote('payee')}
            label="Vote for Worker"
            description="The hirer's claim is invalid"
            color={COLORS.success}
          />
          
          <VoteOption
            selected={selectedVote === 'abstain'}
            onClick={() => setSelectedVote('abstain')}
            label="Abstain"
            description="Insufficient evidence to decide"
            color={COLORS.textMuted}
          />
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.text }}
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button
            className="flex-1 py-3 rounded-lg font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{ 
              backgroundColor: selectedVote ? COLORS.primary : COLORS.border, 
              color: selectedVote ? COLORS.background : COLORS.textMuted 
            }}
            disabled={!selectedVote}
            onClick={() => selectedVote && onVote(selectedVote)}
          >
            Submit Vote
          </button>
        </div>
      </div>
    </div>
  );
}

function VoteOption({ 
  selected, 
  onClick, 
  label, 
  description, 
  color 
}: { 
  selected: boolean; 
  onClick: () => void; 
  label: string; 
  description: string;
  color: string;
}) {
  return (
    <button
      className="w-full p-4 rounded-xl text-left transition-all"
      style={{ 
        backgroundColor: selected ? `${color}10` : COLORS.surfaceLight,
        border: `2px solid ${selected ? color : COLORS.border}`
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: selected ? color : COLORS.border }}
        >
          {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
        </div>
        <div>
          <p className="font-medium" style={{ color: selected ? color : COLORS.text }}>{label}</p>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>{description}</p>
        </div>
      </div>
    </button>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div 
      className="p-4 rounded-xl text-center"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="flex justify-center mb-2" style={{ color }}>{icon}</div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: COLORS.textMuted }}>{label}</p>
    </div>
  );
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

function getResolutionColor(resolution: DisputeResolution): string {
  switch (resolution) {
    case 'payer_wins': return COLORS.error;
    case 'payee_wins': return COLORS.success;
    case 'split': return COLORS.warning;
    default: return COLORS.textMuted;
  }
}

function getResolutionLabel(resolution: DisputeResolution): string {
  switch (resolution) {
    case 'payer_wins': return 'Hirer Won';
    case 'payee_wins': return 'Worker Won';
    case 'split': return 'Split';
    default: return 'Resolved';
  }
}

export default DisputeMonitor;
