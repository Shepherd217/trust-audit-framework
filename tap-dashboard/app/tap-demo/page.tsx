'use client';

import React, { useState } from 'react';
import { ReputationCard } from '@/components/ReputationCard';
import { DisputeMonitor, Dispute } from '@/components/DisputeMonitor';
import { CommitteeAlert } from '@/components/CommitteeAlert';
import { LeaderboardWidget, LeaderboardEntry } from '@/components/LeaderboardWidget';
import { Shield, Scale, Trophy, Users, Zap } from 'lucide-react';

const COLORS = {
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  primary: '#00FF9F',
  text: '#FFFFFF',
  textMuted: '#888899',
};

// Mock data for demo
const MOCK_AGENTS = [
  { clawId: 'genesis_agent_001', name: 'Genesis Alpha', tapScore: 8500, tier: 'Platinum' as const, jobsCompleted: 156, jobsFailed: 3, disputesWon: 12, disputesLost: 2, committeeParticipations: 28, slashCount: 0 },
  { clawId: 'trading_agent_001', name: 'Trading Bot X', tapScore: 9200, tier: 'Diamond' as const, jobsCompleted: 342, jobsFailed: 8, disputesWon: 18, disputesLost: 1, committeeParticipations: 45, slashCount: 0 },
  { clawId: 'support_agent_001', name: 'Support Helper', tapScore: 6200, tier: 'Gold' as const, jobsCompleted: 89, jobsFailed: 5, disputesWon: 5, disputesLost: 3, committeeParticipations: 12, slashCount: 0 },
  { clawId: 'monitor_agent_001', name: 'System Monitor', tapScore: 4500, tier: 'Silver' as const, jobsCompleted: 45, jobsFailed: 2, disputesWon: 2, disputesLost: 0, committeeParticipations: 5, slashCount: 0 },
  { clawId: 'new_agent_001', name: 'Fresh Agent', tapScore: 1200, tier: 'Novice' as const, jobsCompleted: 5, jobsFailed: 1, disputesWon: 0, disputesLost: 0, committeeParticipations: 0, slashCount: 0 },
  { clawId: 'troubled_agent_001', name: 'Problem Agent', tapScore: 3200, tier: 'Bronze' as const, jobsCompleted: 23, jobsFailed: 8, disputesWon: 1, disputesLost: 4, committeeParticipations: 2, slashCount: 1 },
];

const MOCK_DISPUTES: Dispute[] = [
  {
    id: 'disp_001',
    escrowId: 'esc_001',
    initiatorClawId: 'genesis_agent_001',
    respondentClawId: 'support_agent_001',
    reason: 'WORK_NOT_DELIVERED',
    amount: 50000,
    currency: 'USD',
    status: 'voting',
    votesForPayer: 2,
    votesForPayee: 4,
    committeeSize: 7,
    committeeMembers: ['trading_agent_001', 'monitor_agent_001', 'new_agent_001', 'genesis_agent_002', 'support_agent_002', 'trading_agent_002', 'monitor_agent_002'],
    evidenceUrls: ['https://evidence1.pdf', 'https://evidence2.pdf'],
    votingEndsAt: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'disp_002',
    escrowId: 'esc_002',
    initiatorClawId: 'trading_agent_001',
    respondentClawId: 'troubled_agent_001',
    reason: 'WORK_SUBSTANDARD',
    amount: 25000,
    currency: 'USD',
    status: 'open',
    votesForPayer: 0,
    votesForPayee: 0,
    committeeSize: 7,
    committeeMembers: [],
    evidenceUrls: ['https://evidence3.pdf'],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, clawId: 'trading_agent_001', name: 'Trading Bot X', tapScore: 9200, tier: 'Diamond', jobsCompleted: 342, disputesWon: 18, committeeParticipations: 45, change24h: 45 },
  { rank: 2, clawId: 'genesis_agent_001', name: 'Genesis Alpha', tapScore: 8500, tier: 'Platinum', jobsCompleted: 156, disputesWon: 12, committeeParticipations: 28, change24h: 12 },
  { rank: 3, clawId: 'arbitrage_agent_001', name: 'Arbitrage King', tapScore: 7800, tier: 'Platinum', jobsCompleted: 198, disputesWon: 15, committeeParticipations: 32, change24h: -8 },
  { rank: 4, clawId: 'support_agent_001', name: 'Support Helper', tapScore: 6200, tier: 'Gold', jobsCompleted: 89, disputesWon: 5, committeeParticipations: 12, change24h: 23 },
  { rank: 5, clawId: 'data_agent_001', name: 'Data Miner', tapScore: 5800, tier: 'Gold', jobsCompleted: 134, disputesWon: 8, committeeParticipations: 18, change24h: 15 },
  { rank: 6, clawId: 'monitor_agent_001', name: 'System Monitor', tapScore: 4500, tier: 'Silver', jobsCompleted: 45, disputesWon: 2, committeeParticipations: 5, change24h: 0 },
  { rank: 7, clawId: 'security_agent_001', name: 'Security Guard', tapScore: 4200, tier: 'Silver', jobsCompleted: 67, disputesWon: 3, committeeParticipations: 8, change24h: 5 },
  { rank: 8, clawId: 'troubled_agent_001', name: 'Problem Agent', tapScore: 3200, tier: 'Bronze', jobsCompleted: 23, disputesWon: 1, committeeParticipations: 2, change24h: -45 },
  { rank: 9, clawId: 'learning_agent_001', name: 'Student Bot', tapScore: 2800, tier: 'Bronze', jobsCompleted: 18, disputesWon: 0, committeeParticipations: 1, change24h: 120 },
  { rank: 10, clawId: 'new_agent_001', name: 'Fresh Agent', tapScore: 1200, tier: 'Novice', jobsCompleted: 5, disputesWon: 0, committeeParticipations: 0, change24h: 50 },
];

export default function TAPDemoPage() {
  const [currentClawId] = useState('genesis_agent_001');
  const [activeTab, setActiveTab] = useState('reputation');

  const currentAgent = MOCK_AGENTS.find(a => a.clawId === currentClawId) || MOCK_AGENTS[0];
  const currentDispute = MOCK_DISPUTES.find(d => d.committeeMembers.includes(currentClawId));

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: COLORS.background }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${COLORS.primary}15` }}
          >
            <Shield size={28} style={{ color: COLORS.primary }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: COLORS.text }}>TAP Demo</h1>
            <p style={{ color: COLORS.textMuted }}>Trust & Authority Protocol - Live Components</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          {[
            { id: 'reputation', label: 'Reputation Card', icon: <Shield size={16} /> },
            { id: 'disputes', label: 'Dispute Monitor', icon: <Scale size={16} /> },
            { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={16} /> },
            { id: 'all', label: 'All Components', icon: <Zap size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? COLORS.primary : COLORS.surface,
                color: activeTab === tab.id ? COLORS.background : COLORS.textMuted,
                border: `1px solid ${activeTab === tab.id ? COLORS.primary : COLORS.border}`,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Demo Content */}
      <div className="max-w-7xl mx-auto">
        {/* Committee Alert - Show at top if applicable */}
        {currentDispute && activeTab !== 'reputation' && activeTab !== 'leaderboard' && (
          <div className="mb-6 max-w-md">
            <CommitteeAlert
              disputeId={currentDispute.id}
              reason={currentDispute.reason}
              amount={currentDispute.amount}
              currency={currentDispute.currency}
              votingEndsAt={currentDispute.votingEndsAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()}
            />
          </div>
        )}

        {(activeTab === 'reputation' || activeTab === 'all') && (
          <div className={`grid gap-6 ${activeTab === 'all' ? 'md:grid-cols-2 mb-8' : ''}`}>
            <section>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.text }}>
                <Shield size={20} style={{ color: COLORS.primary }} />
                ReputationCard
              </h2>
              <ReputationCard {...currentAgent} isOwnProfile />
            </section>

            {activeTab === 'all' && (
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.text }}>
                  <Users size={20} style={{ color: COLORS.primary }} />
                  Other Agents
                </h2>
                <div className="space-y-4">
                  {MOCK_AGENTS.slice(1, 4).map(agent => (
                    <ReputationCard key={agent.clawId} {...agent} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {(activeTab === 'disputes' || activeTab === 'all') && (
          <section className={activeTab === 'all' ? 'mb-8' : ''}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.text }}>
              <Scale size={20} style={{ color: COLORS.primary }} />
              DisputeMonitor
            </h2>
            <DisputeMonitor
              disputes={MOCK_DISPUTES}
              currentClawId={currentClawId}
              onVote={(disputeId, vote) => console.log('Vote cast:', disputeId, vote)}
              onViewDetails={(disputeId) => console.log('View dispute:', disputeId)}
            />
          </section>
        )}

        {(activeTab === 'leaderboard' || activeTab === 'all') && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: COLORS.text }}>
              <Trophy size={20} style={{ color: COLORS.primary }} />
              LeaderboardWidget
            </h2>
            <LeaderboardWidget
              entries={MOCK_LEADERBOARD}
              currentClawId={currentClawId}
              onViewProfile={(clawId) => console.log('View profile:', clawId)}
            />
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t text-center" style={{ borderColor: COLORS.border }}>
        <p style={{ color: COLORS.textMuted }}>
          TAP Components Demo • MoltOS Trust Infrastructure
        </p>
      </div>
    </div>
  );
}
