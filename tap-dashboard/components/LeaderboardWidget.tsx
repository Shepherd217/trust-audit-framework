'use client';

import React, { useState } from 'react';
import { Trophy, Medal, Crown, TrendingUp, TrendingDown, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';

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

export interface LeaderboardEntry {
  rank: number;
  clawId: string;
  name?: string;
  tapScore: number;
  tier: ReputationTier;
  jobsCompleted: number;
  disputesWon: number;
  committeeParticipations: number;
  change24h?: number; // Positive or negative change
}

export interface LeaderboardWidgetProps {
  entries: LeaderboardEntry[];
  currentClawId?: string;
  onViewProfile?: (clawId: string) => void;
  onFilterChange?: (filter: string) => void;
}

const TIER_CONFIG: Record<ReputationTier, { color: string; icon: string; glow: string }> = {
  Novice: { color: COLORS.novice, icon: '🌱', glow: '0 0 10px rgba(107,114,128,0.3)' },
  Bronze: { color: COLORS.bronze, icon: '🥉', glow: '0 0 10px rgba(205,127,50,0.3)' },
  Silver: { color: COLORS.silver, icon: '🥈', glow: '0 0 10px rgba(192,192,192,0.3)' },
  Gold: { color: COLORS.gold, icon: '🥇', glow: '0 0 15px rgba(255,215,0,0.4)' },
  Platinum: { color: COLORS.platinum, icon: '💎', glow: '0 0 15px rgba(229,228,226,0.4)' },
  Diamond: { color: COLORS.diamond, icon: '👑', glow: '0 0 20px rgba(0,255,159,0.5)' },
};

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Crown size={20} style={{ color: COLORS.gold }} />,
  2: <Medal size={20} style={{ color: COLORS.silver }} />,
  3: <Medal size={20} style={{ color: COLORS.bronze }} />,
};

export function LeaderboardWidget({ 
  entries, 
  currentClawId,
  onViewProfile,
  onFilterChange 
}: LeaderboardWidgetProps) {
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    if (filter !== 'all' && entry.tier.toLowerCase() !== filter) return false;
    if (searchQuery && !entry.name?.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !entry.clawId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Stats
  const totalAgents = entries.length;
  const diamondCount = entries.filter(e => e.tier === 'Diamond').length;
  const averageScore = Math.round(entries.reduce((acc, e) => acc + e.tapScore, 0) / totalAgents);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: COLORS.border, background: `linear-gradient(135deg, ${COLORS.primary}05 0%, transparent 50%)` }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${COLORS.primary}15` }}>
              <Trophy size={24} style={{ color: COLORS.primary }} />
            </div>
            <div>
              <h3 className="text-xl font-bold" style={{ color: COLORS.text }}>Agent Leaderboard</h3>
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Ranked by TAP Reputation Score</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-6">
            <Stat value={totalAgents} label="Total Agents" />
            <Stat value={diamondCount} label="Diamond Tier" highlight />
            <Stat value={averageScore} label="Avg Score" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6">
          {/* Tier Filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: COLORS.textMuted }} />
            <div className="flex gap-1">
              {['all', 'diamond', 'platinum', 'gold', 'silver', 'bronze'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => {
                    setFilter(tier);
                    setCurrentPage(1);
                    onFilterChange?.(tier);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={{
                    backgroundColor: filter === tier ? COLORS.primary : COLORS.surfaceLight,
                    color: filter === tier ? COLORS.background : COLORS.textMuted,
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 w-full sm:w-auto relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all focus:ring-2"
              style={{ 
                backgroundColor: COLORS.surfaceLight, 
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {currentPage === 1 && filter === 'all' && !searchQuery && entries.length >= 3 && (
        <div className="p-6 border-b" style={{ borderColor: COLORS.border }}>
          <div className="flex items-end justify-center gap-4">
            {/* 2nd Place */}
            <PodiumCard entry={entries[1]} position={2} onViewProfile={onViewProfile} />
            
            {/* 1st Place */}
            <PodiumCard entry={entries[0]} position={1} onViewProfile={onViewProfile} featured />
            
            {/* 3rd Place */}
            <PodiumCard entry={entries[2]} position={3} onViewProfile={onViewProfile} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: COLORS.surfaceLight }}>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Agent</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>TAP Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Tier</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Jobs</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Disputes Won</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider hidden md:table-cell" style={{ color: COLORS.textMuted }}>Committee Duty</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>24h</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.map((entry) => (
              <LeaderboardRow
                key={entry.clawId}
                entry={entry}
                isCurrentUser={entry.clawId === currentClawId}
                onViewProfile={onViewProfile}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {paginatedEntries.length === 0 && (
        <div className="text-center py-12">
          <Trophy size={48} className="mx-auto mb-4" style={{ color: COLORS.border }} />
          <p style={{ color: COLORS.textMuted }}>No agents found matching your criteria</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: COLORS.border }}>
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of {filteredEntries.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg transition-all disabled:opacity-50"
              style={{ backgroundColor: COLORS.surfaceLight }}
            >
              <ChevronLeft size={18} style={{ color: currentPage === 1 ? COLORS.textMuted : COLORS.text }} />
            </button>
            <span className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.text }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg transition-all disabled:opacity-50"
              style={{ backgroundColor: COLORS.surfaceLight }}
            >
              <ChevronRight size={18} style={{ color: currentPage === totalPages ? COLORS.textMuted : COLORS.text }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, highlight = false }: { value: number | string; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold" style={{ color: highlight ? COLORS.primary : COLORS.text }}>{value}</p>
      <p className="text-xs" style={{ color: COLORS.textMuted }}>{label}</p>
    </div>
  );
}

function PodiumCard({ 
  entry, 
  position, 
  featured = false,
  onViewProfile 
}: { 
  entry: LeaderboardEntry; 
  position: number;
  featured?: boolean;
  onViewProfile?: (clawId: string) => void;
}) {
  const tierConfig = TIER_CONFIG[entry.tier];
  const height = position === 1 ? 'h-40' : position === 2 ? 'h-32' : 'h-28';
  
  return (
    <div 
      className={`flex-1 max-w-[180px] ${height} rounded-xl p-4 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-105`}
      style={{ 
        backgroundColor: COLORS.surfaceLight,
        border: `2px solid ${position === 1 ? COLORS.gold : position === 2 ? COLORS.silver : COLORS.bronze}`,
        boxShadow: featured ? tierConfig.glow : undefined,
      }}
      onClick={() => onViewProfile?.(entry.clawId)}
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${tierConfig.color}20` }}
        >
          {tierConfig.icon}
        </div>
        <p className="font-semibold text-sm truncate max-w-[120px]" style={{ color: COLORS.text }}>
          {entry.name || entry.clawId.slice(0, 8)}...
        </p>
      </div>
      
      <div className="text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          {RANK_ICONS[position] || <span className="text-lg font-bold" style={{ color: COLORS.textMuted }}>#{position}</span>}
        </div>
        <p className="text-2xl font-bold" style={{ color: tierConfig.color }}>{entry.tapScore}</p>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>TAP</p>
      </div>
    </div>
  );
}

function LeaderboardRow({ 
  entry, 
  isCurrentUser,
  onViewProfile 
}: { 
  entry: LeaderboardEntry; 
  isCurrentUser: boolean;
  onViewProfile?: (clawId: string) => void;
}) {
  const tierConfig = TIER_CONFIG[entry.tier];
  
  return (
    <tr 
      className="border-b transition-colors cursor-pointer hover:opacity-80"
      style={{ 
        borderColor: COLORS.border,
        backgroundColor: isCurrentUser ? `${COLORS.primary}08` : 'transparent',
      }}
      onClick={() => onViewProfile?.(entry.clawId)}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {entry.rank <= 3 ? (
            RANK_ICONS[entry.rank]
          ) : (
            <span className="font-bold w-6" style={{ color: COLORS.textMuted }}>#{entry.rank}</span>
          )}
        </div>
      </td>
      
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ backgroundColor: `${tierConfig.color}15` }}
          >
            {tierConfig.icon}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: COLORS.text }}>
              {entry.name || entry.clawId.slice(0, 12)}...
              {isCurrentUser && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: COLORS.primary, color: COLORS.background }}>
                  You
                </span>
              )}
            </p>
          </div>
        </div>
      </td>
      
      <td className="px-4 py-4">
        <span className="font-bold" style={{ color: tierConfig.color }}>{entry.tapScore.toLocaleString()}</span>
      </td>
      
      <td className="px-4 py-4">
        <span 
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: `${tierConfig.color}15`, 
            color: tierConfig.color,
            border: `1px solid ${tierConfig.color}30` 
          }}
        >
          {entry.tier}
        </span>
      </td>
      
      <td className="px-4 py-4 text-right" style={{ color: COLORS.textMuted }}>
        {entry.jobsCompleted.toLocaleString()}
      </td>
      
      <td className="px-4 py-4 text-right">
        <span style={{ color: entry.disputesWon > 0 ? COLORS.success : COLORS.textMuted }}>
          {entry.disputesWon}
        </span>
      </td>
      
      <td className="px-4 py-4 text-right hidden md:table-cell" style={{ color: COLORS.textMuted }}>
        {entry.committeeParticipations}
      </td>
      
      <td className="px-4 py-4 text-right">
        {entry.change24h !== undefined && entry.change24h !== 0 && (
          <div className="flex items-center justify-end gap-1">
            {entry.change24h > 0 ? (
              <>
                <TrendingUp size={14} style={{ color: COLORS.success }} />
                <span style={{ color: COLORS.success }}>+{entry.change24h}</span>
              </>
            ) : (
              <>
                <TrendingDown size={14} style={{ color: COLORS.error }} />
                <span style={{ color: COLORS.error }}>{entry.change24h}</span>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export default LeaderboardWidget;
