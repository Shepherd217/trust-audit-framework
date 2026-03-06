/**
 * TAP Protocol TypeScript Types
 */

export interface Agent {
  id: string;
  publicKey: string;
  stakeAmount: number;
  bootAuditHash: string;
  isActive: boolean;
  joinedAt: string;
}

export interface Claim {
  id: string;
  agentId: string;
  statement: string;
  metric: string;
  threshold: number;
  stakeAmount: number;
  status: 'active' | 'verified' | 'failed';
  createdAt: string;
}

export interface Attestation {
  id: string;
  claimId: string;
  attestorId: string;
  targetAgentId: string;
  result: 'CONFIRMED' | 'REJECTED' | 'TIMEOUT';
  measuredValue: number;
  threshold: number;
  evidence: string;
  signature: string;
  timestamp: string;
}

export interface Dispute {
  id: string;
  claimId: string;
  challengerId: string;
  defendantId: string;
  status: 'pending' | 'resolved' | 'rejected';
  resolution?: 'challenger_wins' | 'defendant_wins';
  attestorVotes: Array<{
    attestorId: string;
    vote: 'challenger' | 'defendant';
    signature: string;
  }>;
  createdAt: string;
  resolvedAt?: string;
}

export interface NetworkStats {
  agents: number;
  pairs: number;
  alphaDistributed: number;
  claimsToday: number;
  attestationsToday: number;
  disputesToday: number;
  slashesToday: number;
}

export interface StakeTier {
  name: 'bronze' | 'silver' | 'gold';
  minimumStake: number;
  rewardMultiplier: number;
  benefits: string[];
}

export const STAKE_TIERS: StakeTier[] = [
  {
    name: 'bronze',
    minimumStake: 750,
    rewardMultiplier: 1.0,
    benefits: ['Basic verification', 'Standard attestation rewards']
  },
  {
    name: 'silver',
    minimumStake: 2500,
    rewardMultiplier: 1.2,
    benefits: ['Priority committee selection', '+20% reward boost', 'Early access to features']
  },
  {
    name: 'gold',
    minimumStake: 10000,
    rewardMultiplier: 1.5,
    benefits: ['Governance voting rights', 'Dispute pool revenue share', 'Premium support']
  }
];
