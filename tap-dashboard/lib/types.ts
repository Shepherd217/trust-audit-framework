// ── Agent ──────────────────────────────────────────────
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
export type AgentStatus = 'active' | 'inactive' | 'suspended'

export interface Agent {
  agent_id: string
  name: string
  publicKey: string
  reputation: number
  tier: Tier
  status: AgentStatus
  email?: string
  metadata?: Record<string, unknown>
  created_at: string
  last_seen_at?: string
}

export interface AgentListItem {
  agent_id: string
  name: string
  reputation: number
  tier: Tier
  status: AgentStatus
  created_at: string
  dao_ids?: string[]
  dao_names?: string[]
}

// ── Leaderboard ────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number
  agent_id: string
  name: string
  reputation: number
  tier: Tier
}

export interface LeaderboardResponse {
  agents: LeaderboardEntry[]
}

// ── Registration ───────────────────────────────────────
export interface RegisterBody {
  name: string
  publicKey: string
  email?: string
  referral_code?: string
  metadata?: Record<string, unknown>
}

export interface RegisterResponse {
  success: boolean
  agent: {
    agentId: string
    name: string
    reputation: number
    tier: Tier
    status: AgentStatus
    activationStatus: string
    isGenesis: boolean
    createdAt: string
  }
  credentials: {
    apiKey: string
    baseUrl: string
  }
  message: string
}

// ── Attestation ────────────────────────────────────────
export interface AttestBody {
  target_id: string
  claim: string
  score: number
  email?: string
  metadata?: Record<string, unknown>
}

export interface AttestResponse {
  success: boolean
  attestation_id: string
  timestamp: string
}

// ── Auth ───────────────────────────────────────────────
export interface AuthResponse {
  success: boolean
  agent: Agent & { createdAt: string }
}

// ── Earnings ───────────────────────────────────────────
export interface EarningsResponse {
  total_earned: number
  pending_withdrawal: number
  payment_history: PaymentRecord[]
}

export interface PaymentRecord {
  id: string
  amount: number
  status: string
  created_at: string
}

// ── Arbitra ────────────────────────────────────────────
export interface ArbitraEligibility {
  eligible: boolean
  current_reputation: number
  required_reputation: number
  max_committee_size: number
  current_committee_count: number
}

// ── ClawBus ────────────────────────────────────────────
export interface ClawMessage {
  id: string
  type: 'request' | 'response' | 'broadcast' | 'handoff'
  from_agent: string
  to_agent: string
  channel?: string
  payload: Record<string, unknown>
  context?: Record<string, unknown>
  priority: number
  created_at: string
  read_at?: string
}

// ── ClawFS ─────────────────────────────────────────────
export interface ClawFile {
  cid: string
  filename: string
  size: number
  mime_type?: string
  storage_tier: 'hot' | 'warm' | 'cold'
  created_at: string
}

// ── Workflow ───────────────────────────────────────────
export interface Workflow {
  id: string
  name: string
  version: number
  nodes: unknown[]
  edges: unknown[]
  owner_id: string
  is_active: boolean
  created_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  started_at?: string
  completed_at?: string
}

// ── Tier config ────────────────────────────────────────
export const TIER_CONFIG: Record<string, {
  color: string
  bg: string
  border: string
  min: number
  max: number
  next?: Tier
}> = {
  // Capitalized (canonical)
  Bronze:   { color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  border: 'rgba(205,127,50,0.3)',  min: 0,  max: 19,  next: 'Silver'   },
  Silver:   { color: '#c0c0c0', bg: 'rgba(192,192,192,0.12)', border: 'rgba(192,192,192,0.3)', min: 20, max: 39,  next: 'Gold'     },
  Gold:     { color: '#ffd700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.3)',   min: 40, max: 59,  next: 'Platinum' },
  Platinum: { color: '#e5e4e2', bg: 'rgba(229,228,226,0.12)', border: 'rgba(229,228,226,0.3)', min: 60, max: 79,  next: 'Diamond'  },
  Diamond:  { color: '#b9f2ff', bg: 'rgba(185,242,255,0.15)', border: 'rgba(185,242,255,0.4)', min: 80, max: 100              },
  // Lowercase aliases (DB stores lowercase)
  bronze:   { color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  border: 'rgba(205,127,50,0.3)',  min: 0,  max: 19,  next: 'Silver'   },
  silver:   { color: '#c0c0c0', bg: 'rgba(192,192,192,0.12)', border: 'rgba(192,192,192,0.3)', min: 20, max: 39,  next: 'Gold'     },
  gold:     { color: '#ffd700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.3)',   min: 40, max: 59,  next: 'Platinum' },
  platinum: { color: '#e5e4e2', bg: 'rgba(229,228,226,0.12)', border: 'rgba(229,228,226,0.3)', min: 60, max: 79,  next: 'Diamond'  },
  diamond:  { color: '#b9f2ff', bg: 'rgba(185,242,255,0.15)', border: 'rgba(185,242,255,0.4)', min: 80, max: 100              },
}

// ── Stats ─────────────────────────────────────────────
export interface StatsResponse {
  liveAgents: number
  avgReputation: number
  activeSwarms: number
  openDisputes: number
  timestamp?: string
  error?: string
}
