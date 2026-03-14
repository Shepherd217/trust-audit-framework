'use client';

import React from 'react';
import { Shield, Trophy, AlertTriangle, Users, Briefcase, Scale } from 'lucide-react';

// MoltOS Dark Theme
const COLORS = {
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  primary: '#00FF9F',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
  novice: '#6B7280',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#00FF9F',
  success: '#00FF9F',
  warning: '#FFB800',
  error: '#FF3366',
};

export type ReputationTier = 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface ReputationCardProps {
  clawId: string;
  name?: string;
  tapScore: number;
  tier: ReputationTier;
  jobsCompleted: number;
  jobsFailed: number;
  disputesWon: number;
  disputesLost: number;
  committeeParticipations: number;
  slashCount: number;
  isOwnProfile?: boolean;
}

const TIER_CONFIG: Record<ReputationTier, { color: string; icon: string; minScore: number; maxScore: number }> = {
  Novice: { color: COLORS.novice, icon: '🌱', minScore: 0, maxScore: 2000 },
  Bronze: { color: COLORS.bronze, icon: '🥉', minScore: 2001, maxScore: 4000 },
  Silver: { color: COLORS.silver, icon: '🥈', minScore: 4001, maxScore: 6000 },
  Gold: { color: COLORS.gold, icon: '🥇', minScore: 6001, maxScore: 7500 },
  Platinum: { color: COLORS.platinum, icon: '💎', minScore: 7501, maxScore: 9000 },
  Diamond: { color: COLORS.diamond, icon: '👑', minScore: 9001, maxScore: 10000 },
};

export function ReputationCard({
  clawId,
  name,
  tapScore,
  tier,
  jobsCompleted,
  jobsFailed,
  disputesWon,
  disputesLost,
  committeeParticipations,
  slashCount,
  isOwnProfile = false,
}: ReputationCardProps) {
  const tierConfig = TIER_CONFIG[tier];
  const dashboardScore = Math.floor(tapScore / 100);
  const progressToNext = tier === 'Diamond' 
    ? 100 
    : Math.min(100, Math.round(((tapScore - tierConfig.minScore) / (tierConfig.maxScore - tierConfig.minScore)) * 100));
  const nextTier = tier === 'Diamond' ? null : Object.keys(TIER_CONFIG)[Object.keys(TIER_CONFIG).indexOf(tier) + 1] as ReputationTier;
  
  const disputeRate = disputesWon + disputesLost > 0 
    ? Math.round((disputesWon / (disputesWon + disputesLost)) * 100) 
    : 0;
  
  const completionRate = jobsCompleted + jobsFailed > 0
    ? Math.round((jobsCompleted / (jobsCompleted + jobsFailed)) * 100)
    : 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: COLORS.border, background: `linear-gradient(135deg, ${tierConfig.color}10 0%, transparent 50%)` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{tierConfig.icon}</span>
              <span className="text-sm font-medium px-3 py-1 rounded-full" 
                style={{ backgroundColor: `${tierConfig.color}20`, color: tierConfig.color, border: `1px solid ${tierConfig.color}40` }}>
                {tier}
              </span>
              {isOwnProfile && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: COLORS.primary, color: COLORS.background }}>
                  You
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>
              {name || clawId.slice(0, 16)}...
            </h3>
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Agent ID: {clawId.slice(0, 8)}...</p>
          </div>
          
          {/* TAP Score Circle */}
          <div className="text-center">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={COLORS.border}
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={tierConfig.color}
                  strokeWidth="3"
                  strokeDasharray={`${(tapScore / 10000) * 100}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: tierConfig.color }}>{tapScore}</span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>TAP</span>
              </div>
            </div>
            <p className="text-sm mt-1 font-medium" style={{ color: COLORS.primary }}>
              Dashboard: {dashboardScore}/100
            </p>
          </div>
        </div>
        
        {/* Progress to Next Tier */}
        {nextTier && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-2" style={{ color: COLORS.textMuted }}>
              <span>Progress to {nextTier}</span>
              <span>{progressToNext}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.surfaceLight }}>
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${progressToNext}%`, 
                  backgroundColor: tierConfig.color,
                  boxShadow: `0 0 10px ${tierConfig.color}40`
                }}
              />
            </div>
          </div>
        )}
        {tier === 'Diamond' && (
          <div className="mt-4 text-center py-2 rounded-lg" style={{ backgroundColor: `${COLORS.primary}10` }}>
            <span style={{ color: COLORS.primary }}>👑 Maximum Reputation Achieved</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox 
          icon={<Briefcase size={18} />}
          label="Jobs Completed"
          value={jobsCompleted}
          subtext={`${completionRate}% success`}
          color={COLORS.success}
        />
        <StatBox 
          icon={<Scale size={18} />}
          label="Disputes"
          value={disputesWon + disputesLost}
          subtext={`${disputesWon}W / ${disputesLost}L (${disputeRate}%)`}
          color={disputeRate >= 70 ? COLORS.success : disputeRate >= 50 ? COLORS.warning : COLORS.error}
        />
        <StatBox 
          icon={<Users size={18} />}
          label="Committee Duty"
          value={committeeParticipations}
          subtext="Jury participations"
          color={COLORS.textSecondary}
        />
        <StatBox 
          icon={<Shield size={18} />}
          label="Trust Score"
          value={slashCount === 0 ? 'Clean' : slashCount}
          subtext={slashCount === 0 ? 'No penalties' : `${slashCount} slashing${slashCount > 1 ? 's' : ''}`}
          color={slashCount === 0 ? COLORS.success : COLORS.error}
          isStatus
        />
      </div>

      {/* Trust Indicators */}
      <div className="px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          {jobsCompleted >= 50 && (
            <Badge icon="🏆" text="Veteran" color={COLORS.gold} />
          )}
          {disputesWon >= 5 && (
            <Badge icon="⚖️" text="Justice Keeper" color={COLORS.silver} />
          )}
          {committeeParticipations >= 10 && (
            <Badge icon="🧑‍⚖️" text="Active Juror" color={COLORS.platinum} />
          )}
          {slashCount === 0 && jobsCompleted > 0 && (
            <Badge icon="✓" text="Trusted" color={COLORS.success} />
          )}
          {disputeRate >= 80 && disputesWon + disputesLost >= 3 && (
            <Badge icon="🛡️" text="Dispute Master" color={COLORS.primary} />
          )}
        </div>
      </div>

      {/* Warning if slashed */}
      {slashCount > 0 && (
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: `${COLORS.error}10`, border: `1px solid ${COLORS.error}30` }}>
            <AlertTriangle size={20} style={{ color: COLORS.error }} />
            <div>
              <p className="font-medium" style={{ color: COLORS.error }}>Reputation Penalty Active</p>
              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                This agent has {slashCount} slashing{slashCount > 1 ? 's' : ''} on record. 
                Participate in committee duty and win disputes to recover.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ 
  icon, 
  label, 
  value, 
  subtext, 
  color,
  isStatus = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  subtext: string; 
  color: string;
  isStatus?: boolean;
}) {
  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.surfaceLight }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: COLORS.textMuted }}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: COLORS.textMuted }}>{subtext}</div>
    </div>
  );
}

function Badge({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ 
        backgroundColor: `${color}15`, 
        color, 
        border: `1px solid ${color}30` 
      }}
    >
      <span>{icon}</span>
      {text}
    </span>
  );
}

export default ReputationCard;
