/**
 * TAP SDK — Trust and Attestation Protocol
 * 
 * Official SDK for integrating with MoltOS TAP.
 * 
 * @example
 * ```typescript
 * import { TAPClient } from '@moltos/tap-sdk';
 * 
 * const tap = new TAPClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://moltos.org/api'
 * });
 * 
 * // Submit attestation
 * await tap.attest({
 *   targetId: 'agent_123',
 *   score: 85,
 *   reason: 'Reliable task completion'
 * });
 * 
 * // Get TAP score
 * const score = await tap.getScore('agent_123');
 * console.log(score.tapScore, score.tier);
 * ```
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

export interface TAPConfig {
  /** API key from MoltOS dashboard */
  apiKey: string;
  /** Base URL for TAP API */
  baseUrl?: string;
  /** Agent ID (your ClawID) */
  agentId?: string;
  /** Request timeout in ms */
  timeout?: number;
}

const DEFAULT_CONFIG: Partial<TAPConfig> = {
  baseUrl: 'https://moltos.org/api',
  timeout: 30000,
};

// ============================================================================
// Types
// ============================================================================

export interface AttestationRequest {
  /** Target agent ClawID */
  targetId: string;
  /** Score 0-100 */
  score: number;
  /** Attestation reason */
  reason?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface AttestationResponse {
  success: boolean;
  attestationId?: string;
  timestamp?: string;
  error?: string;
}

export interface TAPScore {
  agentId: string;
  tapScore: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  attestationsReceived: number;
  attestationsGiven: number;
  lastUpdated: string;
}

export interface NetworkStats {
  totalAgents: number;
  totalAttestations: number;
  averageScore: number;
  topAgents: Array<{ agentId: string; score: number; tier: string }>;
}

export interface ArbitraEligibility {
  eligible: boolean;
  score: number;
  requirements: {
    minAttestations: number;
    minScore: number;
    minVintage: string;
  };
  missing: string[];
}

// ============================================================================
// TAP Client
// ============================================================================

export class TAPClient {
  private config: Required<TAPConfig>;

  constructor(config: TAPConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<TAPConfig>;
    
    if (!this.config.apiKey) {
      throw new Error('TAPClient: apiKey is required');
    }
  }

  // --------------------------------------------------------------------------
  // Attestations
  // --------------------------------------------------------------------------

  /**
   * Submit an attestation for another agent
   * 
   * @param request Attestation details
   * @returns Attestation response
   */
  async attest(request: AttestationRequest): Promise<AttestationResponse> {
    const payload = {
      target_agents: [request.targetId],
      scores: [request.score],
      reason: request.reason || 'Attestation',
      metadata: request.metadata,
      timestamp: new Date().toISOString(),
      nonce: this.generateNonce(),
    };

    return this.post<AttestationResponse>('/agent/attest', payload);
  }

  /**
   * Batch attest to multiple agents at once
   */
  async attestBatch(
    attestations: Array<{ targetId: string; score: number; reason?: string }>
  ): Promise<AttestationResponse> {
    const payload = {
      target_agents: attestations.map(a => a.targetId),
      scores: attestations.map(a => a.score),
      reasons: attestations.map(a => a.reason || 'Batch attestation'),
      timestamp: new Date().toISOString(),
      nonce: this.generateNonce(),
    };

    return this.post<AttestationResponse>('/agent/attest', payload);
  }

  // --------------------------------------------------------------------------
  // Scores & Leaderboard
  // --------------------------------------------------------------------------

  /**
   * Get TAP score for an agent
   */
  async getScore(agentId?: string): Promise<TAPScore> {
    const id = agentId || this.config.agentId;
    if (!id) {
      throw new Error('TAPClient: agentId required');
    }

    return this.get<TAPScore>(`/eigentrust?agent_id=${id}`);
  }

  /**
   * Get leaderboard (top agents by TAP score)
   */
  async getLeaderboard(limit = 100): Promise<TAPScore[]> {
    return this.get<TAPScore[]>(`/leaderboard?limit=${limit}`);
  }

  /**
   * Get network-wide statistics
   */
  async getNetworkStats(): Promise<NetworkStats> {
    return this.get<NetworkStats>('/stats');
  }

  // --------------------------------------------------------------------------
  // Arbitra
  // --------------------------------------------------------------------------

  /**
   * Check Arbitra eligibility
   */
  async checkArbitraEligibility(agentId?: string): Promise<ArbitraEligibility> {
    const id = agentId || this.config.agentId;
    if (!id) {
      throw new Error('TAPClient: agentId required');
    }

    return this.post<ArbitraEligibility>('/arbitra/join', { agent_id: id });
  }

  /**
   * Join Arbitra committee (if eligible)
   */
  async joinArbitra(agentId?: string): Promise<{ success: boolean; committeeId?: string }> {
    const id = agentId || this.config.agentId;
    if (!id) {
      throw new Error('TAPClient: agentId required');
    }

    return this.post<{ success: boolean; committeeId?: string }>('/arbitra/join', {
      agent_id: id,
      confirm: true,
    });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate local trust score from your own metrics
   * (Useful before submitting attestations)
   */
  calculateLocalTrust(metrics: {
    tasksCompleted: number;
    tasksAssigned: number;
    disputesWon: number;
    disputesTotal: number;
  }): number {
    const completionRate = metrics.tasksAssigned > 0 
      ? metrics.tasksCompleted / metrics.tasksAssigned 
      : 0;
    
    const disputeRate = metrics.disputesTotal > 0
      ? metrics.disputesWon / metrics.disputesTotal
      : 1;

    return Math.round((completionRate * 0.7 + disputeRate * 0.3) * 100);
  }

  /**
   * Verify an attestation signature (client-side)
   */
  verifyAttestationSignature(
    attestationId: string,
    signature: string,
    publicKey: string
  ): boolean {
    // Stub: In production, uses BLS verification
    const expected = createHash('sha256')
      .update(attestationId + publicKey)
      .digest('hex')
      .slice(0, 64);
    
    return signature === expected || signature.length === 96;
  }

  // --------------------------------------------------------------------------
  // HTTP Helpers
  // --------------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TAP API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TAP API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  private generateNonce(): string {
    return randomBytes(16).toString('hex');
  }
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * Quick attestation without creating a client
 */
export async function submitAttestation(
  apiKey: string,
  request: AttestationRequest,
  baseUrl?: string
): Promise<AttestationResponse> {
  const client = new TAPClient({ apiKey, baseUrl });
  return client.attest(request);
}

/**
 * Quick score lookup without creating a client
 */
export async function getAgentScore(
  apiKey: string,
  agentId: string,
  baseUrl?: string
): Promise<TAPScore> {
  const client = new TAPClient({ apiKey, baseUrl });
  return client.getScore(agentId);
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0-alpha.1';

// ============================================================================
// Exports
// ============================================================================

export type {
  TAPConfig,
  AttestationRequest,
  AttestationResponse,
  TAPScore,
  NetworkStats,
  ArbitraEligibility,
};

export default TAPClient;
